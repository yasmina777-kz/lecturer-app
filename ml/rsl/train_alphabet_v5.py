"""Train the v5 letter recognizer: temporal CNN on camera-like windows.

Differences from v4 (MLP on 474 aggregated features):
* Input is the full 16x66 frame sequence (the browser's temporalFrame vectors
  after the same gap interpolation and wrist normalization), so finger motion
  order is not averaged away into four bins.
* Training windows are cut from every frame of each clip at a jittered ~100 ms
  cadence with random offsets, the way LiveLetterStream samples the camera,
  plus whole-clip uniform windows used by "completed" captures.
* Augmentation: 3D hand rotation, scale, landmark noise, dropped frames.

Splits are unchanged: official Bukva test signers are the regression test set
(the same 612 clips v4 reports), validation signers are a hash-selected subset
of official train signers. The test set is evaluated once after selection.
Writes to --output; never overwrites serving assets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn

from seqnet import SeqNet, export, reference_forward, rotation
from extract_alphabet import aggregate

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'ml/rsl/data/alphabet'
CACHE = DATA / 'features-v5'
LABELS = list('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ') + ['no_event']
NO_EVENT = LABELS.index('no_event')
T = 16


def normalize_window(frames: np.ndarray) -> np.ndarray:
    """Python twin of the first half of temporal.ts temporalFeatures (the `a` array)."""
    a = np.array(frames, dtype=np.float64)
    valid = a[:, 65] > 0
    if valid.any():
        idx = np.flatnonzero(valid)
        for c in range(66):
            a[:, c] = np.interp(np.arange(len(a)), idx, a[idx, c])
        scale = max(float(np.median(a[valid, 65])), .02)
        a[:, 63:65] = (a[:, 63:65] - a[idx[0], 63:65]) / scale
    else:
        a[:] = 0
    a[:, 65] = valid.astype(float)
    return a.astype(np.float32)


def whole_clip(frames: np.ndarray) -> np.ndarray:
    n = len(frames)
    return frames[np.floor(np.arange(T) * (n - 1) / (T - 1)).astype(int)] if n else np.zeros((T, 66), np.float32)


def stream_window(frames, times, rng, cadence=None, start=None):
    duration = float(times[-1]) if len(times) else 0.
    cadence = cadence if cadence is not None else rng.uniform(85, 125)
    span = cadence * (T - 1)
    if start is None:
        slack = .3 * span
        start = rng.uniform(-slack, max(0., duration - span) + slack)
    at = np.clip(start + np.arange(T) * cadence, 0, duration)
    return frames[np.clip(np.searchsorted(times, at), 0, len(frames) - 1)]


def augment(window: np.ndarray, rng) -> np.ndarray:
    w = window.copy()
    valid = w[:, 65] > 0
    if valid.any():
        shape = w[:, :63].reshape(T, 21, 3) @ rotation(rng).T
        shape *= rng.uniform(.92, 1.08)
        shape += rng.normal(0, .015, shape.shape)
        w[:, :63] = shape.reshape(T, 63)
        w[:, 63:65] *= rng.uniform(.8, 1.2)
        w[:, 63:65] += rng.normal(0, .003, (T, 2))
        w[:, 65] *= rng.uniform(.85, 1.15)
        w[~valid] = 0
        if rng.random() < .35:
            keep = np.flatnonzero(valid)
            if len(keep) > 9:
                drop = rng.choice(keep, size=rng.integers(1, min(5, len(keep) - 8) + 1), replace=False)
                w[drop] = 0
    return w


def load(rows):
    clips = []
    for r in rows:
        d = np.load(CACHE / (r['attachment_id'] + '.npz'))
        clips.append((d['frames'], d['times'], LABELS.index(r['text']), r['user_id']))
    return clips


def batch_windows(clips, rng, per_clip):
    xs, ys = [], []
    for frames, times, y, _ in clips:
        for k in range(per_clip):
            w = whole_clip(frames) if k == 0 else stream_window(frames, times, rng)
            xs.append(normalize_window(augment(w, rng)))
            ys.append(y)
    return np.stack(xs), np.array(ys)


def metrics(p, y, visible, threshold, margin=.2):
    prediction = p.argmax(1)
    ranked = np.sort(p, axis=1)
    accepted = ((ranked[:, -1] >= threshold) & (ranked[:, -1] - ranked[:, -2] >= margin) &
                (prediction != NO_EVENT) & (visible >= .5))
    correct = prediction == y
    negative = y == NO_EVENT
    return dict(samples=int(len(y)), accuracy=float(correct.mean()), accepted=int(accepted.sum()),
                correctAccepted=int((accepted & correct).sum()), wrongAccepted=int((accepted & ~correct).sum()),
                precision=float(correct[accepted].mean()) if accepted.any() else 0.,
                coverage=float(accepted.mean()),
                negativeFalsePositiveRate=float(accepted[negative].mean()) if negative.any() else None)


def per_class(p, y, threshold, margin=.2):
    pred, ranked = p.argmax(1), np.sort(p, 1)
    acc = (ranked[:, -1] >= threshold) & (ranked[:, -1] - ranked[:, -2] >= margin) & (pred != NO_EVENT)
    return [dict(label=l, samples=int((y == i).sum()), correct=int(((y == i) & (pred == y)).sum()),
                 accepted=int(((y == i) & acc).sum()), correctAccepted=int(((y == i) & acc & (pred == y)).sum()))
            for i, l in enumerate(LABELS)]


def v4_probabilities(model: dict, windows: np.ndarray) -> np.ndarray:
    out = []
    mean, std = np.array(model['mean']), np.array(model['std'])
    for w in windows:
        h = (aggregate(w) - mean) / std
        for layer in model.get('layers', []):
            h = np.maximum(np.array(layer['weights']) @ h + np.array(layer['bias']), 0)
        z = np.array(model['weights']) @ h + np.array(model['bias'])
        e = np.exp(z - z.max())
        out.append(e / e.sum())
    return np.array(out)


def streaming_eval(clips, predict, threshold, margin=.2):
    """Replay each clip at 100 ms cadence with a 4-sample stride (LiveLetterStream)
    and require two consecutive agreeing accepted windows, like the browser."""
    results = []
    for frames, times, y, _ in clips:
        duration = float(times[-1])
        starts = np.arange(0, max(0., duration - 1500) + 1, 400) if duration > 1500 else [0.]
        windows = np.stack([normalize_window(stream_window(frames, times, None, 100., s)) for s in starts])
        p = predict(windows)
        pred, ranked = p.argmax(1), np.sort(p, 1)
        ok = ((ranked[:, -1] >= threshold) & (ranked[:, -1] - ranked[:, -2] >= margin) & (pred != NO_EVENT)
              & ((windows[:, :, 65] > 0).sum(1) >= 8))
        emitted = None
        for i in range(len(pred)):
            if ok[i] and (len(pred) == 1 or (i > 0 and ok[i - 1] and pred[i - 1] == pred[i])):
                emitted = int(pred[i])
                break
        results.append((y, emitted))
    signed = [(y, e) for y, e in results if y != NO_EVENT]
    return dict(clips=len(signed), emitted=sum(e is not None for _, e in signed),
                correct=sum(e == y for y, e in signed), wrong=sum(e is not None and e != y for y, e in signed),
                noEventFalseEmits=sum(e is not None for y, e in results if y == NO_EVENT))


def predict_fn(model, mean, std, device):
    def run(windows):
        with torch.no_grad():
            x = torch.tensor((windows - mean) / std, dtype=torch.float32, device=device)
            return torch.softmax(model(x), 1).cpu().numpy()
    return run


def train_one(fit, mean, std, seed, epochs, device, width, per_clip=4):
    torch.manual_seed(seed)
    rng = np.random.default_rng(seed)
    model = SeqNet(66, len(LABELS), width=width, hidden=256, dropout=.25).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-3)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=3e-3, total_steps=epochs * 40)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=.1)
    for epoch in range(epochs):
        x, y = batch_windows(fit, rng, per_clip)
        x = torch.tensor((x - mean) / std, dtype=torch.float32, device=device)
        y = torch.tensor(y, device=device)
        order = torch.randperm(len(y), device=device)
        model.train()
        total = 0.
        for i, chunk in enumerate(order.tensor_split(40)):
            opt.zero_grad()
            loss = loss_fn(model(x[chunk]), y[chunk])
            loss.backward()
            opt.step()
            sched.step()
            total += loss.item()
        if epoch % 10 == 0 or epoch == epochs - 1:
            print(f'seed {seed} epoch {epoch} loss {total / 40:.3f}', flush=True)
    return model.eval()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'ml/rsl/data/alphabet-v5')
    parser.add_argument('--epochs', type=int, default=90)
    parser.add_argument('--width', type=int, default=128)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    device = 'cpu'
    raw = (DATA / 'manifest.json').read_bytes()
    rows = [r for r in json.loads(raw) if (CACHE / (r['attachment_id'] + '.npz')).exists()]
    train_users = {r['user_id'] for r in rows if r['train'] == 'True'}
    test_users = {r['user_id'] for r in rows if r['train'] == 'False'}
    assert not train_users & test_users, 'Signer leakage'
    val_users = {u for u in train_users if int(hashlib.sha256(u.encode()).hexdigest()[:8], 16) % 5 == 0}
    split = lambda r: 'test' if r['train'] == 'False' else 'validation' if r['user_id'] in val_users else 'fit'
    sets = {s: load([r for r in rows if split(r) == s]) for s in ('fit', 'validation', 'test')}
    print({k: len(v) for k, v in sets.items()}, flush=True)

    stats_rng = np.random.default_rng(0)
    sample, _ = batch_windows(sets['fit'], stats_rng, 2)
    mean = sample.reshape(-1, 66).mean(0)
    std = np.maximum(sample.reshape(-1, 66).std(0), .05)

    # Phase 1: model selection on validation signers only.
    model = train_one(sets['fit'], mean, std, 42, args.epochs, device, args.width)
    predict = predict_fn(model, mean, std, device)
    vx = np.stack([normalize_window(whole_clip(f)) for f, _, _, _ in sets['validation']])
    vy = np.array([y for _, _, y, _ in sets['validation']])
    vv = (vx[:, :, 65] > 0).mean(1)
    vp = predict(vx)
    scores = [dict(threshold=t, **metrics(vp, vy, vv, t)) for t in (.5, .6, .7, .8, .85, .9, .95)]
    for s in scores:
        print('validation', s, flush=True)
    eligible = [s for s in scores if s['precision'] >= .97 and (s['negativeFalsePositiveRate'] or 0) <= .1]
    chosen = max(eligible, key=lambda s: s['coverage']) if eligible else max(scores, key=lambda s: s['precision'])
    threshold = chosen['threshold']

    # Phase 2: refit on fit+validation with identical settings, then test once.
    final = train_one(sets['fit'] + sets['validation'], mean, std, 42, args.epochs, device, args.width)
    exported = export(final, mean, std, LABELS, frames=T, threshold=threshold, margin=.2,
                      kind='temporal-alphabet-v5', input='temporalFrame-normalized')
    serve = lambda w: np.stack([reference_forward(exported, x) for x in w])  # exact browser math (fp16 weights)

    tx = np.stack([normalize_window(whole_clip(f)) for f, _, _, _ in sets['test']])
    ty = np.array([y for _, _, y, _ in sets['test']])
    tv = (tx[:, :, 65] > 0).mean(1)
    tp = serve(tx)
    v4 = json.loads((ROOT / 'frontend/public/models/rsl/alphabet-v4-classifier.json').read_text())
    raw_test = np.stack([whole_clip(f) for f, _, _, _ in sets['test']])
    v4p = v4_probabilities(v4, raw_test)
    report = dict(
        scope='Bukva official test signers (same clip selection as v4); real camera accuracy may differ',
        manifestSha256=hashlib.sha256(raw).hexdigest(),
        splitCounts={k: len(v) for k, v in sets.items()},
        signers={'fit': len({c[3] for c in sets['fit']}), 'validation': len({c[3] for c in sets['validation']}),
                 'test': len({c[3] for c in sets['test']})},
        model=dict(arch='temporal CNN', **final.spec, epochs=args.epochs),
        validationThresholds=scores, threshold=threshold,
        test=dict(v5=metrics(tp, ty, tv, threshold), v4=metrics(v4p, ty, tv, v4['threshold'])),
        perClass=per_class(tp, ty, threshold),
        streaming=dict(
            note='100 ms cadence, 400 ms stride, two agreeing accepted windows',
            v5=streaming_eval(sets['test'], serve, threshold),
            v4=streaming_eval(sets['test'], lambda w: v4_probabilities(v4, w), v4['threshold'])),
        seconds=round(time.monotonic() - started, 1))
    (args.output / 'classifier.json').write_text(json.dumps(exported, ensure_ascii=False))
    (args.output / 'fixtures.json').write_text(json.dumps(
        [dict(frames=raw_test[i].tolist(), probabilities=tp[i].tolist()) for i in range(0, len(raw_test), 51)]))
    (args.output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k not in ('perClass', 'validationThresholds')},
                     ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
