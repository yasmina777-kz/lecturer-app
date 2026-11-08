"""Train, select on validation only, then evaluate once on held-out people.

Writes a local research candidate. Publishing is a separate step and requires
passing the predeclared gate; no fabricated sentence generation is involved.
"""
import argparse
import hashlib
import json
import time
from pathlib import Path

import numpy as np
import torch
from expression_model import ExpressionClassifier, normalize, resample

DATA = Path(__file__).resolve().parent / 'data/expressions'


def load():
    manifest = json.loads((DATA / 'manifest.json').read_text())
    people = {s: {r['signer'] for r in manifest['samples'] if r['split'] == s} for s in ('train', 'val', 'test')}
    for a, b in [('train', 'val'), ('train', 'test'), ('val', 'test')]:
        assert not people[a] & people[b], 'Signer leakage'
        hashes_a = {r['videoSha256'] for r in manifest['samples'] if r['split'] == a}
        hashes_b = {r['videoSha256'] for r in manifest['samples'] if r['split'] == b}
        assert not hashes_a & hashes_b, 'Duplicate video leakage'
    sets = {}
    for split in ['train', 'val', 'test']:
        samples = [r for r in manifest['samples'] if r['split'] == split]
        sequences = []
        for row in samples:
            with np.load(DATA / 'features' / (row['id'] + '.npz'), allow_pickle=False) as f:
                sequences.append(normalize(f['rows']))
        sets[split] = (samples, sequences, np.array([r['target'] + 1 for r in samples]))
    return manifest, sets


def metrics(probabilities, labels, threshold, margin):
    prediction = probabilities.argmax(1)
    sorted_scores = np.sort(probabilities, axis=1)
    accepted = (prediction > 0) & (sorted_scores[:, -1] >= threshold) & (sorted_scores[:, -1] - sorted_scores[:, -2] >= margin)
    known = labels > 0
    correct = prediction == labels
    return dict(samples=len(labels), known=int(known.sum()), unknown=int((~known).sum()),
                top1=float(correct[known].mean()), accepted=int(accepted.sum()),
                precision=float(correct[accepted].mean()) if accepted.any() else 0.,
                knownCoverage=float(accepted[known].mean()),
                unknownRejection=float((~accepted[~known]).mean()) if (~known).any() else 0.,
                correctAccepted=int((correct & accepted).sum()))


@torch.inference_mode()
def predict(model, sequences):
    return model(torch.from_numpy(np.stack([resample(x) for x in sequences]))).softmax(-1).numpy()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--epochs', type=int, default=160)
    args = parser.parse_args()
    torch.set_num_threads(4)
    torch.manual_seed(42)
    rng = np.random.default_rng(42)
    manifest, sets = load()
    model = ExpressionClassifier(len(manifest['labels']) + 1)
    optimizer = torch.optim.AdamW(model.parameters(), lr=.001, weight_decay=.01)
    rows, sequences, labels = sets['train']
    best, best_state, best_epoch = -1., None, 0
    history = []
    started = time.monotonic()
    for epoch in range(1, args.epochs + 1):
        model.train()
        order = rng.permutation(len(rows))
        losses = []
        for begin in range(0, len(order), 24):
            indices = order[begin:begin+24]
            augmented = []
            for i in indices:
                x = sequences[i]
                trim = max(0, len(x) // 10)
                a, b = int(rng.integers(trim+1)), len(x) - int(rng.integers(trim+1))
                x = resample(x[a:b])
                x += rng.normal(0, .008, x.shape).astype(np.float32)
                augmented.append(x)
            optimizer.zero_grad()
            logits = model(torch.from_numpy(np.stack(augmented)))
            loss = torch.nn.functional.cross_entropy(logits, torch.from_numpy(labels[indices]), label_smoothing=.04)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 2)
            optimizer.step()
            losses.append(float(loss.detach()))
        model.eval()
        vp = predict(model, sets['val'][1])
        vl = sets['val'][2]
        # Balanced classes, including out-of-vocabulary, not sample-weighted.
        score = float(np.mean([(vp.argmax(1)[vl == c] == c).mean() for c in np.unique(vl)]))
        history.append(dict(epoch=epoch, loss=float(np.mean(losses)), validationMacroAccuracy=score))
        if score > best:
            best, best_epoch = score, epoch
            best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}
        if epoch % 20 == 0:
            print(json.dumps(dict(epoch=epoch, bestValidation=best, elapsed=round(time.monotonic()-started))), flush=True)
    model.load_state_dict(best_state)
    model.eval()
    vp = predict(model, sets['val'][1])
    # Threshold chosen exclusively on validation; never tuned to the test set.
    candidates = []
    for threshold in [.5, .6, .7, .8, .9, .95]:
        for margin in [.1, .2, .3]:
            m = metrics(vp, sets['val'][2], threshold, margin)
            if m['precision'] >= .9 and m['unknownRejection'] >= .8:
                candidates.append((m['knownCoverage'], threshold, margin))
    calibrated = bool(candidates)
    _, threshold, margin = max(candidates) if candidates else (0, .95, .3)
    validation = metrics(vp, sets['val'][2], threshold, margin)
    tp = predict(model, sets['test'][1])
    test = metrics(tp, sets['test'][2], threshold, margin)
    per_class = {label: metrics(tp[sets['test'][2] == i+1], sets['test'][2][sets['test'][2] == i+1], threshold, margin)
                 for i, label in enumerate(manifest['labels'])}
    gate = dict(minPrecision=.9, minKnownCoverage=.5, minUnknownRejection=.8, minTop1=.8)
    ready = calibrated and all(m['precision'] >= .9 and m['knownCoverage'] >= .5 and
                               m['unknownRejection'] >= .8 and m['top1'] >= .8 for m in [validation, test])
    report = dict(scope=manifest['scope'], labels=manifest['labels'], readyForPilot=ready,
                  gate=gate, validation=validation, test=test, perClass=per_class,
                  bestEpoch=best_epoch, epochs=args.epochs, threshold=threshold, margin=margin,
                  parameters=sum(p.numel() for p in model.parameters()),
                  manifestSha256=hashlib.sha256((DATA/'manifest.json').read_bytes()).hexdigest(),
                  splitCounts={s: len(sets[s][0]) for s in sets},
                  signerCounts={s: len({r['signer'] for r in sets[s][0]}) for s in sets},
                  seconds=round(time.monotonic()-started, 2), history=history)
    torch.save(dict(model_state=best_state, labels=manifest['labels'], report=report), DATA/'candidate.pt')
    (DATA/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    predictions = [dict(id=r['id'], expected=r['label'], predicted=manifest['labels'][int(p.argmax())-1] if p.argmax() else '[other]',
                        scores=p.tolist()) for r, p in zip(sets['test'][0], tp)]
    (DATA/'test-predictions.json').write_text(json.dumps(predictions, ensure_ascii=False, indent=2))
    print(json.dumps({k:v for k,v in report.items() if k not in ['history','perClass']}, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
