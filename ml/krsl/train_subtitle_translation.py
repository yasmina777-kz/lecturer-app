"""Train and honestly evaluate a weakly supervised video-to-Russian baseline.

Whole recordings (including related parts) must remain in one split. Text
subtitles are translation targets, never silently converted to CTC gloss labels.
No serving weights are modified. Unreviewed subtitle data is research-only.
"""
import argparse
import json
import random
import re
import time
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from torch.nn import functional as F

from extract_subtitle_features import fingerprint
from prepare_youtube_corpus import digest
from runtime import DATA
from subtitle_model import BOS, EOS, PAD, UNK, NORMALIZATION_VERSION, SubtitleTranslator, normalize_landmarks
from train import distance


def normalized_text(text):
    return ' '.join(re.findall(r'[а-яёa-z0-9]+', text.lower()))


def validate_splits(sources, mapping):
    groups, hashes = {}, set()
    if set(mapping) != {s['video_id'] for s in sources}:
        raise ValueError('Every downloaded source must have exactly one explicit split')
    for source in sources:
        assignment = mapping[source['video_id']]
        split, group = assignment['split'], assignment['recordingGroup']
        if split not in {'train', 'val', 'test'} or not group:
            raise ValueError('Invalid split or empty recording group')
        if group in groups and groups[group] != split:
            raise ValueError('Related recordings cross splits')
        if source['videoSha256'] in hashes:
            raise ValueError('Duplicate source video')
        groups[group] = split
        hashes.add(source['videoSha256'])
    if set(groups.values()) != {'train', 'val', 'test'}:
        raise ValueError('Train, validation and test recordings are required')


def load_samples(audit, segments, mapping, cache):
    sources = audit['sources']
    validate_splits(sources, mapping)
    samples, rejected = [], Counter()
    fingerprints = {}
    for source in sources:
        vid = source['video_id']
        with np.load(cache / f'{vid}.npz', allow_pickle=False) as archive:
            key = str(archive['fingerprint'])
            if key != fingerprint(source):
                raise ValueError(f'Stale extraction cache: {vid}')
            rows, timestamps = archive['rows'], archive['timestamps']
        fingerprints[vid] = key
        for index, cue in enumerate(segments):
            if cue['video_id'] != vid:
                continue
            text = normalized_text(cue['translation'])
            if not 1 <= cue['end']-cue['start'] <= 20 or not 1 <= len(text) <= 240:
                rejected['duration_or_text_length'] += 1
                continue
            # A fixed 0.25s context; never extend across source/split boundaries.
            clip = rows[(timestamps >= max(0, cue['start']-.25)) & (timestamps < cue['end']+.25)]
            if len(clip) < 6:
                rejected['too_few_frames'] += 1
                continue
            hand = np.any(clip[:, :126] != 0, axis=1).mean()
            body = np.any(clip[:, 126:144] != 0, axis=1).mean()
            face = np.any(clip[:, 144:] != 0, axis=1).mean()
            if hand < .35 or body < .5 or face < .3:
                rejected['tracking'] += 1
                continue
            # ~6.25 Hz after extraction; both frames and deltas go to the encoder.
            features = normalize_landmarks(clip)[::2].copy()
            samples.append(dict(id=f'{vid}:{index}', video_id=vid,
                                split=mapping[vid]['split'], text=text, features=features,
                                start=cue['start'], end=cue['end']))
    if any(not any(r['split'] == split for r in samples) for split in ['train', 'val', 'test']):
        raise ValueError('Tracking/length filters emptied a split')
    return samples, dict(rejected), fingerprints


def batch(rows, vocabulary, device, zero=False):
    lengths = torch.tensor([len(r['features']) for r in rows], device=device)
    x = torch.zeros(len(rows), int(lengths.max()), 180, device=device)
    encoded = [[BOS] + [vocabulary.get(c, UNK) for c in r['text']] + [EOS] for r in rows]
    y = torch.full((len(rows), max(map(len, encoded))), PAD, dtype=torch.long, device=device)
    for i, row in enumerate(rows):
        if not zero:
            x[i, :len(row['features'])] = torch.from_numpy(row['features']).to(device)
        y[i, :len(encoded[i])] = torch.tensor(encoded[i], device=device)
    return x, lengths, y


def decode(ids, chars):
    result = []
    for i in ids:
        if i == EOS:
            break
        if i >= 4:
            result.append(chars[i-4])
        elif i == UNK:
            result.append('�')
    return ''.join(result).strip()


def metrics(records):
    words = sum(len(r['reference'].split()) for r in records)
    chars = sum(len(r['reference']) for r in records)
    errors = sum(distance(r['reference'].split(), r['predicted'].split()) for r in records)
    char_errors = sum(distance(r['reference'], r['predicted']) for r in records)
    return dict(wer=errors / max(words, 1), cer=char_errors / max(chars, 1),
                wordErrors=errors, referenceWords=words, phrases=len(records),
                exactPhrases=sum(r['reference'] == r['predicted'] for r in records),
                exactPhraseRate=sum(r['reference'] == r['predicted'] for r in records) / max(len(records), 1))


@torch.inference_mode()
def evaluate(model, rows, chars, vocabulary, device, batch_size, zero=False):
    model.eval()
    records = []
    for offset in range(0, len(rows), batch_size):
        items = rows[offset:offset+batch_size]
        x, lengths, _ = batch(items, vocabulary, device, zero)
        predictions = model.generate(x, lengths).cpu().tolist()
        records.extend(dict(id=r['id'], reference=r['text'], predicted=decode(p, chars))
                       for r, p in zip(items, predictions))
    return metrics(records), records


def main(args):
    random.seed(42); np.random.seed(42); torch.manual_seed(42)
    torch.set_num_threads(4)
    device = torch.device(args.device)
    audit = json.loads(args.audit.read_text())
    mapping = json.loads(args.splits.read_text())
    samples, rejected, fingerprints = load_samples(audit, json.loads(args.segments.read_text()), mapping, args.features)
    sets = {s: [r for r in samples if r['split'] == s] for s in ['train', 'val', 'test']}
    # Neither validation nor test text can expand the learned vocabulary.
    chars = sorted(set(''.join(r['text'] for r in sets['train'])))
    vocabulary = {c: i+4 for i, c in enumerate(chars)}
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:6]
    output = args.output / stamp
    output.mkdir(parents=True, exist_ok=False)
    model = SubtitleTranslator(len(chars)+4).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, weight_decay=.01)
    train_words = {w for r in sets['train'] for w in r['text'].split()}
    common_target = Counter(r['text'] for r in sets['train']).most_common(1)[0][0]
    report = dict(run=stamp, status='training', researchOnly=True, deploymentEligible=False,
                  model='Holistic 180D + temporal Transformer encoder + character decoder',
                  pretrainedLanguageModel=False, initializedFrom='random seed 42',
                  parameters=sum(p.numel() for p in model.parameters()), normalization=NORMALIZATION_VERSION,
                  supervision='unreviewed subtitle translation; not gesture glosses',
                  splits=mapping, rejected=rejected, featureFingerprints=fingerprints,
                  manifestSha256=digest(args.segments), splitSha256=digest(args.splits),
                  sourceIndexSha256=audit['indexSha256'], torch=torch.__version__, device=str(device),
                  sources=[{k: s.get(k) for k in ['video_id', 'url', 'channel_id', 'videoSha256', 'captionSha256', 'sourceLicense']} for s in audit['sources']],
                  limitations=['Only four videos; not representative of live webcam use',
                               'Validation shares a channel with training; signer identities not audited',
                               'Test is a held-out channel and topic, not a general phrase benchmark',
                               'Subtitle timing/translation has not been checked by an RSL annotator',
                               'No silent/no-sign negatives; hallucination rejection not calibrated'],
                  history=[], dataset={})
    for split, rows in sets.items():
        words = [w for r in rows for w in r['text'].split()]
        report['dataset'][split] = dict(clips=len(rows), videos=len({r['video_id'] for r in rows}),
                                        words=len(words), unknownWordFraction=sum(w not in train_words for w in words)/max(len(words), 1))
    report['constantBaseline'] = {s: metrics([dict(reference=r['text'], predicted=common_target) for r in sets[s]]) for s in ['val', 'test']}
    (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(dict(output=str(output), dataset=report['dataset'], parameters=report['parameters'])), flush=True)
    best, stale, started = float('inf'), 0, time.monotonic()
    for epoch in range(1, args.epochs+1):
        model.train()
        rows = list(sets['train']); random.shuffle(rows)
        losses = []
        for offset in range(0, len(rows), args.batch_size):
            x, lengths, y = batch(rows[offset:offset+args.batch_size], vocabulary, device)
            # Mild landmark noise only where there is an observation.
            x = x + torch.randn_like(x) * .005 * (x != 0)
            logits = model(x, lengths, y[:, :-1])
            loss = F.cross_entropy(logits.reshape(-1, len(chars)+4), y[:, 1:].reshape(-1),
                                   ignore_index=PAD, label_smoothing=.05)
            if not torch.isfinite(loss):
                raise ValueError('Non-finite training loss')
            optimizer.zero_grad(); loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.)
            optimizer.step(); losses.append(float(loss.detach()))
        entry = dict(epoch=epoch, loss=sum(losses)/len(losses), elapsed=round(time.monotonic()-started, 1))
        if epoch % args.evaluate_every == 0 or epoch == args.epochs:
            val, _ = evaluate(model, sets['val'], chars, vocabulary, device, args.batch_size)
            entry['validation'] = val
            # Free-running predictions, not teacher-forced accuracy, select the checkpoint.
            if val['wer'] < best:
                best, stale = val['wer'], 0
                report['bestEpoch'] = epoch
                torch.save(dict(model_state={k: v.detach().cpu() for k,v in model.state_dict().items()},
                                config=model.config, chars=chars, epoch=epoch, researchOnly=True,
                                normalization=NORMALIZATION_VERSION, splitSha256=report['splitSha256']), output / 'candidate.pt')
            else:
                stale += args.evaluate_every
        report['history'].append(entry)
        (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(json.dumps(entry), flush=True)
        if stale >= args.patience:
            break
    checkpoint = torch.load(output / 'candidate.pt', weights_only=True, map_location='cpu')
    model.load_state_dict(checkpoint['model_state'])
    # Test is consulted once, after validation-only model selection. No test-based tuning.
    report['validation'], _ = evaluate(model, sets['val'], chars, vocabulary, device, args.batch_size)
    report['test'], predictions = evaluate(model, sets['test'], chars, vocabulary, device, args.batch_size)
    report['testWithZeroVisualInput'], _ = evaluate(model, sets['test'], chars, vocabulary, device, args.batch_size, zero=True)
    report['visualWerGain'] = report['testWithZeroVisualInput']['wer'] - report['test']['wer']
    report.update(status='complete', seconds=round(time.monotonic()-started, 1),
                  checkpointSha256=digest(output / 'candidate.pt'), checkpointBytes=(output / 'candidate.pt').stat().st_size,
                  conclusion='Research pilot only. No production activation; reviewed phrase data and webcam evaluation are still required.')
    (output / 'test-predictions.json').write_text(json.dumps(predictions, ensure_ascii=False, indent=2))
    (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(dict(output=str(output), validation=report['validation'], test=report['test'],
                          visualWerGain=report['visualWerGain'], deploymentEligible=False)), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    base = DATA / 'sources/youtube-sl-25/review'
    parser.add_argument('--audit', type=Path, default=base / 'source-audit.json')
    parser.add_argument('--segments', type=Path, default=base / 'review-segments.json')
    parser.add_argument('--splits', type=Path, required=True)
    parser.add_argument('--features', type=Path, default=DATA / 'subtitle-features')
    parser.add_argument('--output', type=Path, default=DATA / 'subtitle-training')
    parser.add_argument('--device', choices=['cpu', 'mps'], default='cpu')
    parser.add_argument('--epochs', type=int, default=60)
    parser.add_argument('--batch-size', type=int, default=16)
    parser.add_argument('--learning-rate', type=float, default=.0007)
    parser.add_argument('--evaluate-every', type=int, default=5)
    parser.add_argument('--patience', type=int, default=15)
    main(parser.parse_args())
