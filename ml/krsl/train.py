"""Opt-in fine tuning on labeled videos, with signer/broadcast-disjoint validation.

Never replaces the deployed model automatically. JSON manifest rows:
{video: absolute/relative path, tokens: [vocabulary lemma,...], group: signer/broadcast,
 split: train|val|test}. Only known tokens, no silent <UNK> labels.
"""
import argparse
import hashlib
import json
import random
from pathlib import Path
import numpy as np
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
        if row['split'] not in {'train', 'val', 'test'} or not row['group'] or not row['tokens']:
            raise ValueError('Every clip needs split, group and nonempty tokens')
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
    if not all(any(row['split'] == split for row in rows) for split in ['train', 'val', 'test']):
        raise ValueError('Separate train, val and test splits are required')
    return rows


@torch.inference_mode()
def evaluate(model, rows, vocabulary):
    model.eval()
    errors, total, records = 0, 0, []
    for row in rows:
        x = torch.from_numpy(row['features'])[None]
        predicted = decode_ctc(model(x, torch.tensor([x.shape[1]]))[0], vocabulary)
        errors += distance(row['tokens'], predicted); total += len(row['tokens'])
        records.append({'sha256': row['sha256'], 'reference': row['tokens'], 'predicted': predicted})
    return {'wer': errors / max(total, 1), 'errors': errors, 'referenceTokens': total, 'examples': records}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--epochs', type=int, default=5)
    parser.add_argument('--evaluate-only', action='store_true')
    args = parser.parse_args()
    torch.manual_seed(42); random.seed(42); np.random.seed(42)
    vocab = json.loads((DATA / 'vocab.json').read_text())
    rows = read_manifest(args.manifest, vocab['token2idx'])
    engine = Engine()
    folder = DATA / 'training'; folder.mkdir(exist_ok=True)
    for row in rows:
        cache = folder / (row['sha256'] + '.npy')
        if not cache.exists():
            features, _ = engine.extract(row['video']); np.save(cache, features)
        row['features'] = np.load(cache, allow_pickle=False)
        # CTC needs an extra timestep between repeated labels.
        required = len(row['tokens']) + sum(a == b for a, b in zip(row['tokens'], row['tokens'][1:]))
        if len(row['features']) < required:
            raise ValueError('Clip is too short for its transcript')
    validation = [r for r in rows if r['split'] == 'val']
    test = [r for r in rows if r['split'] == 'test']
    report = {'seed': 42, 'baselineVal': evaluate(engine.model, validation, engine.vocab),
              'baselineTest': evaluate(engine.model, test, engine.vocab), 'epochs': []}
    best = report['baselineVal']['wer']
    best_state = {k: v.clone() for k, v in engine.model.state_dict().items()}
    if not args.evaluate_only:
        optimizer = torch.optim.AdamW(engine.model.parameters(), lr=1e-5, weight_decay=.01)
        loss_fn = torch.nn.CTCLoss(blank=0, zero_infinity=False)
        train = [r for r in rows if r['split'] == 'train']
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
            if score['wer'] < best:
                best = score['wer']; best_state = {k: v.clone() for k, v in engine.model.state_dict().items()}
        engine.model.load_state_dict(best_state)
        report['candidateTest'] = evaluate(engine.model, test, engine.vocab)
        report['improvedValidation'] = best < report['baselineVal']['wer']
        if report['improvedValidation']:
            original = torch.load(DATA / 'checkpoint.pt', weights_only=True, map_location='cpu')
            torch.save({'model_state': best_state, 'cfg': original['cfg'], 'metrics': {'wer': best}}, folder / 'candidate.pt')
    report['scope'] = 'Only this manifest; not whole-language accuracy. Test is not used to select epochs.'
    (folder / 'evaluation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    engine.close()
    print('Report:', folder / 'evaluation.json')


if __name__ == '__main__': main()
