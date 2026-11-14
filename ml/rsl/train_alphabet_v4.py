"""Fit candidates on training signers, calibrate on validation, evaluate test once.

Writes a candidate and evidence to --output, never overwrites serving assets.
The existing test set is a regression set, not a fresh webcam benchmark.
"""
import argparse
import hashlib
import json
import time
from pathlib import Path

import numpy as np
from sklearn.neural_network import MLPClassifier
from threadpoolctl import threadpool_limits
from extract_alphabet import aggregate

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'ml/rsl/data/alphabet'
LABELS = list('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ') + ['no_event']


def metrics(p, y, visible, threshold, margin=.2):
    prediction = p.argmax(1)
    ranked = np.sort(p, axis=1)
    accepted = ((ranked[:, -1] >= threshold) &
                (ranked[:, -1] - ranked[:, -2] >= margin) &
                (prediction != 33) & (visible >= .5))
    correct = prediction == y
    known, negative = y != 33, y == 33
    return dict(samples=len(y), accuracy=float(correct.mean()),
                accepted=int(accepted.sum()), correctAccepted=int((accepted & correct).sum()),
                wrongAccepted=int((accepted & ~correct).sum()),
                precision=float(correct[accepted].mean()) if accepted.any() else 0.,
                coverage=float(accepted.mean()),
                negativeFalsePositiveRate=float(accepted[negative].mean()) if negative.any() else None,
                perClass=[dict(label=label, samples=int((y == i).sum()),
                               correct=int(((y == i) & correct).sum()),
                               accepted=int(((y == i) & accepted).sum()),
                               correctAccepted=int(((y == i) & accepted & correct).sum()))
                          for i, label in enumerate(LABELS)])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    raw = (DATA / 'manifest.json').read_bytes()
    rows = json.loads(raw)
    train_users = {r['user_id'] for r in rows if r['train'] == 'True'}
    test_users = {r['user_id'] for r in rows if r['train'] == 'False'}
    assert not train_users & test_users, 'Signer leakage'
    val_users = {u for u in train_users if int(hashlib.sha256(u.encode()).hexdigest()[:8], 16) % 5 == 0}
    sets = {}
    for split in ('fit', 'validation', 'test'):
        selected = [r for r in rows if (
            r['train'] == 'False' if split == 'test' else
            r['train'] == 'True' and ((r['user_id'] in val_users) == (split == 'validation')))]
        frames = [json.loads((DATA / 'features-v1' / (r['attachment_id'] + '.json')).read_text()) for r in selected]
        sets[split] = (np.array([aggregate(f) for f in frames]),
                       np.array([LABELS.index(r['text']) for r in selected]),
                       np.array([sum(f[65] > 0 for f in fs) / 16 for fs in frames]))
    x, y, _ = sets['fit']
    mean, std = x.mean(0), np.maximum(x.std(0), .05)
    vx, vy, vv = sets['validation']
    candidates, eligible = [], []
    # Fixed search and acceptance gates before evaluating regression test clips.
    for shape, alpha in [((192,), .05), ((192,), .5), ((192, 96), .05), ((192, 96), .5)]:
        model = MLPClassifier(hidden_layer_sizes=shape, alpha=alpha, max_iter=400,
                              random_state=42, early_stopping=False)
        with threadpool_limits(limits=2):
            model.fit((x - mean) / std, y)
        p = model.predict_proba((vx - mean) / std)
        scores = [dict(threshold=t, **metrics(p, vy, vv, t)) for t in (.7, .8, .9, .95)]
        record = dict(shape=shape, alpha=alpha, scores=scores)
        candidates.append(record)
        for score in scores:
            if score['precision'] >= .97 and score['negativeFalsePositiveRate'] <= .1:
                eligible.append((score['coverage'], model, score, record))
        print(json.dumps(dict(shape=shape, alpha=alpha,
                              scores=[{k:v for k,v in s.items() if k != 'perClass'} for s in scores])), flush=True)
    if not eligible:
        (args.output / 'report.json').write_text(json.dumps(dict(ready=False, reason='No candidate passed validation', candidates=candidates), ensure_ascii=False, indent=2))
        return
    _, model, validation, selected = max(eligible, key=lambda v: v[0])
    tx, ty, tv = sets['test']
    p = model.predict_proba((tx - mean) / std)
    test = metrics(p, ty, tv, validation['threshold'])
    ready = test['precision'] >= .95 and test['coverage'] > .38 and test['negativeFalsePositiveRate'] <= .1
    report = dict(ready=ready, scope='Cached real Bukva videos; existing signer-disjoint regression set, not a live camera benchmark',
                  manifestSha256=hashlib.sha256(raw).hexdigest(),
                  splitCounts={k: len(v[1]) for k,v in sets.items()},
                  candidate=dict(shape=selected['shape'], alpha=selected['alpha']),
                  validation=validation, test=test, candidates=candidates,
                  seconds=round(time.monotonic()-started, 2))
    exported = dict(version=4, kind='temporal-alphabet', labels=LABELS, frames=16,
                    mean=mean.tolist(), std=std.tolist(), threshold=validation['threshold'], margin=.2,
                    layers=[dict(weights=w.T.tolist(), bias=b.tolist(), activation='relu')
                            for w,b in zip(model.coefs_[:-1], model.intercepts_[:-1])],
                    weights=model.coefs_[-1].T.tolist(), bias=model.intercepts_[-1].tolist())
    (args.output / 'classifier.json').write_text(json.dumps(exported, ensure_ascii=False))
    (args.output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    (args.output / 'fixtures.json').write_text(json.dumps([
        dict(features=tx[i].tolist(), probabilities=p[i].tolist()) for i in range(min(12, len(tx)))]))
    print(json.dumps({k:v for k,v in report.items() if k != 'candidates'}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
