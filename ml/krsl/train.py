"""Opt-in fine tuning on labeled videos, with signer/broadcast-disjoint validation.

Never replaces the deployed model automatically. JSON manifest rows:
{video: absolute/relative path, tokens: [vocabulary lemma,...], group: signer/broadcast,
 split: train|val|test}. Only known tokens, no silent <UNK> labels.
"""
import argparse
import hashlib
import json
import random
import uuid
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
import numpy as np
import cv2
import torch
from runtime import Engine, DATA
from model import decode_ctc


def distance(reference, hypothesis):
    previous = list(range(len(hypothesis) + 1))
    for i, a in enumerate(reference, 1):
        current = [i]
        for j, b in enumerate(hypothesis, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j-1] + (a != b)))
        previous = current
    return previous[-1]


def read_manifest(path, token2idx):
    rows = json.loads(path.read_text())
    groups, clips = {}, set()
    for row in rows:
        if row.get('split') not in {'train', 'val', 'test'} or not isinstance(row.get('group'), str) or not row['group'].strip():
            raise ValueError('Every clip needs split and signer/broadcast group')
        tokens = row.get('tokens')
        if not isinstance(tokens, list) or any(not isinstance(t, str) for t in tokens):
            raise ValueError('Tokens must be a list of reviewed vocabulary labels')
        if not tokens and row.get('negative') is not True:
            raise ValueError('Empty transcript needs explicit negative: true (no signing)')
        if tokens and row.get('negative'):
            raise ValueError('Negative clips cannot contain transcript tokens')
        if row['group'] in groups and groups[row['group']] != row['split']:
            raise ValueError('Data leakage: a signer/broadcast appears in multiple splits')
        groups[row['group']] = row['split']
        video = (path.parent / row['video']).resolve()
        digest = hashlib.sha256(video.read_bytes()).hexdigest()
        if digest in clips:
            raise ValueError('Duplicate video in manifest')
        clips.add(digest)
        if any(token not in token2idx or token2idx[token] < 2 for token in row['tokens']):
            raise ValueError('Unknown training label: use exact reviewed vocabulary lemmas')
        row.update(video=str(video), sha256=digest)
    if not all(any(row['split'] == split and row['tokens'] for row in rows) for split in ['train', 'val', 'test']):
        raise ValueError('Separate train, val and test splits with labeled signing are required')
    return rows


def dataset_summary(rows):
    summary = {}
    train_tokens = {token for row in rows if row['split'] == 'train' for token in row['tokens']}
    for split in ['train', 'val', 'test']:
        subset = [row for row in rows if row['split'] == split]
        labels = {token for row in subset for token in row['tokens']}
        summary[split] = dict(clips=len(subset), groups=len({r['group'] for r in subset}),
                              phraseClips=sum(len(r['tokens']) > 1 for r in subset),
                              negativeClips=sum(not r['tokens'] for r in subset),
                              vocabulary=len(labels), labelsNotInTrain=sorted(labels - train_tokens))
    return summary


def feature_cache_version():
    # A checkpoint-independent fingerprint: old features cannot survive extractor changes.
    digest = hashlib.sha256(Path(__file__).with_name('runtime.py').read_bytes())
    digest.update((DATA / 'holistic_landmarker.task').read_bytes())
    digest.update(f'OpenCV={cv2.__version__}'.encode())
    for package in ['mediapipe', 'numpy']:
        digest.update(f'{package}={version(package)}'.encode())
    return digest.hexdigest()[:20]


@torch.inference_mode()
def evaluate(model, rows, vocabulary):
    model.eval()
    errors, total, records = 0, 0, []
    exact, positive, negatives, false_positives = 0, 0, 0, 0
    for row in rows:
        x = torch.from_numpy(row['features'])[None]
        predicted = decode_ctc(model(x, torch.tensor([x.shape[1]]))[0], vocabulary)
        if row['tokens']:
            errors += distance(row['tokens'], predicted); total += len(row['tokens'])
            positive += 1; exact += predicted == row['tokens']
        else:
            negatives += 1; false_positives += bool(predicted)
        records.append({'sha256': row['sha256'], 'reference': row['tokens'], 'predicted': predicted})
    return {'wer': errors / total if total else None, 'errors': errors, 'referenceTokens': total,
            'exactPhraseRate': exact / positive if positive else None,
            'negativeClips': negatives, 'falsePositiveClips': false_positives,
            'negativeFalsePositiveRate': false_positives / negatives if negatives else None,
            'examples': records}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--epochs', type=int, default=5)
    parser.add_argument('--evaluate-only', action='store_true')
    parser.add_argument('--check-only', action='store_true', help='Validate corpus without extracting or training')
    parser.add_argument('--patience', type=int, default=3)
    parser.add_argument('--learning-rate', type=float, default=1e-5)
    args = parser.parse_args()
    if args.epochs < 1 or args.patience < 1 or not 0 < args.learning_rate <= 1:
        parser.error("epochs/patience must be positive; learning rate must be in (0, 1]")
    torch.manual_seed(42); random.seed(42); np.random.seed(42)
    vocab = json.loads((DATA / 'vocab.json').read_text())
    rows = read_manifest(args.manifest, vocab['token2idx'])
    summary = dataset_summary(rows)
    print(json.dumps({'dataset': summary}, ensure_ascii=False, indent=2), flush=True)
    if args.check_only:
        return
    engine = Engine()
    try:
        run_training(args, rows, vocab, summary, engine)
    finally:
        engine.close()


def run_training(args, rows, vocab, summary, engine):
    run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + uuid.uuid4().hex[:8]
    folder = DATA / 'training' / run_id; folder.mkdir(parents=True)
    cache_folder = DATA / 'training' / 'features' / feature_cache_version()
    cache_folder.mkdir(parents=True, exist_ok=True)
    for row in rows:
        cache = cache_folder / (row['sha256'] + '.npy')
        if not cache.exists():
            features, _ = engine.extract(row['video']); np.save(cache, features)
        row['features'] = np.load(cache, allow_pickle=False)
        if row['features'].ndim != 2 or row['features'].shape[1] != 180 or not np.isfinite(row['features']).all() or len(row['features']) < 6:
            raise ValueError('Invalid cached features: expected finite T x 180, at least six frames')
        # CTC needs an extra timestep between repeated labels.
        required = len(row['tokens']) + sum(a == b for a, b in zip(row['tokens'], row['tokens'][1:]))
        if len(row['features']) < required:
            raise ValueError('Clip is too short for its transcript')
    validation = [r for r in rows if r['split'] == 'val']
    test = [r for r in rows if r['split'] == 'test']
    report = {'seed': 42, 'dataset': summary, 'learningRate': args.learning_rate,
              'manifestSha256': hashlib.sha256(args.manifest.read_bytes()).hexdigest(),
              'checkpointSha256': hashlib.sha256((DATA / 'checkpoint.pt').read_bytes()).hexdigest(),
              'featureVersion': cache_folder.name,
              'baselineVal': evaluate(engine.model, validation, engine.vocab),
              'baselineTest': evaluate(engine.model, test, engine.vocab), 'epochs': []}
    best = report['baselineVal']['wer']
    best_state = {k: v.clone() for k, v in engine.model.state_dict().items()}
    if not args.evaluate_only:
        optimizer = torch.optim.AdamW(engine.model.parameters(), lr=args.learning_rate, weight_decay=.01)
        loss_fn = torch.nn.CTCLoss(blank=0, zero_infinity=False)
        train = [r for r in rows if r['split'] == 'train']
        stale_epochs = 0
        for epoch in range(args.epochs):
            engine.model.train(); random.shuffle(train); losses = []
            for row in train:
                x = torch.from_numpy(row['features'])[None]
                y = torch.tensor([vocab['token2idx'][t] for t in row['tokens']], dtype=torch.long)
                optimizer.zero_grad()
                logits = engine.model(x, torch.tensor([x.shape[1]]))
                loss = loss_fn(logits.log_softmax(-1).transpose(0, 1), y,
                               torch.tensor([x.shape[1]]), torch.tensor([len(y)]))
                if not torch.isfinite(loss): raise RuntimeError('Non-finite loss; candidate not saved')
                loss.backward(); torch.nn.utils.clip_grad_norm_(engine.model.parameters(), 1.)
                optimizer.step(); losses.append(float(loss.detach()))
            score = evaluate(engine.model, validation, engine.vocab)
            report['epochs'].append({'epoch': epoch + 1, 'loss': float(np.mean(losses)), 'validation': score})
            print(json.dumps({'epoch': epoch + 1, 'wer': score['wer']}, ensure_ascii=False), flush=True)
            # Do not trade fewer word errors for more hallucinations on no-sign clips.
            baseline_fp = report['baselineVal']['negativeFalsePositiveRate']
            negative_ok = baseline_fp is None or score['negativeFalsePositiveRate'] <= baseline_fp
            if score['wer'] < best and negative_ok:
                best = score['wer']; best_state = {k: v.clone() for k, v in engine.model.state_dict().items()}
                report['bestEpoch'] = epoch + 1
                stale_epochs = 0
            else:
                stale_epochs += 1
            if stale_epochs >= args.patience:
                break
        engine.model.load_state_dict(best_state)
        report['candidateTest'] = evaluate(engine.model, test, engine.vocab)
        report['improvedValidation'] = best < report['baselineVal']['wer']
        if report['improvedValidation']:
            original = torch.load(DATA / 'checkpoint.pt', weights_only=True, map_location='cpu')
            torch.save({'model_state': best_state, 'cfg': original['cfg'], 'metrics': {'wer': best},
                        'epoch': report['bestEpoch'], 'training_manifest_sha256': report['manifestSha256']}, folder / 'candidate.pt')
    report['scope'] = 'Only this manifest; not whole-language accuracy. Test is not used to select epochs.'
    (folder / 'evaluation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print('Report:', folder / 'evaluation.json')


if __name__ == '__main__': main()
