"""Isolated RSL word/expression recognizer v2 (Slovo keypoints, temporal CNN).

Why the v1 run (train_slovo_words.py) reached only 18% top-1: the published
train/test flags share 92 of 112 train signers with the test partition, and v1
dropped every overlapping signer, leaving 15 fit signers. Here every clip is
assigned by a hash of its signer id: signer-disjoint fit / validation / test
over all 194 signers. `--protocol official` instead reproduces v1's protocol
(official test, train = non-overlapping signers only) for a like-for-like check.

Outputs go to --output (ignored data dir); serving assets are not touched.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import time
from pathlib import Path

import ijson
import numpy as np
import torch
from torch import nn

from seqnet import SeqNet, export, reference_forward, rotation
from word_features import CHANNELS, clip_features, resample

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'ml/rsl/data'
T = 32


def build_cache(path: Path):
    rows = list(csv.DictReader((DATA / 'slovo-annotations.csv').read_text().splitlines(), delimiter='\t'))
    meta = {r['attachment_id']: r for r in rows}
    chunks, offsets, ids, raw_counts = [], [0], [], []
    started = time.monotonic()
    with (DATA / 'slovo_mediapipe.json').open('rb') as f:
        for n, (clip_id, frames) in enumerate(ijson.kvitems(f, '', use_float=True), 1):
            r = meta.get(clip_id)
            if r is None or r['text'] == 'no_event':
                continue
            hands = [[np.array([[p['x'], p['y'], p['z']] for p in pts]) for key, pts in (fr or {}).items()
                      if isinstance(pts, list) and len(pts) == 21] for fr in frames]
            feats = clip_features(hands, float(r['width']), float(r['height']))
            if feats is None or len(feats) < 4:
                continue
            chunks.append(feats.astype(np.float16))
            offsets.append(offsets[-1] + len(feats))
            ids.append(clip_id)
            raw_counts.append(len(frames))
            if n % 2000 == 0:
                print('PARSED', n, len(ids), round(time.monotonic() - started), flush=True)
    np.savez(path, x=np.concatenate(chunks), offsets=np.array(offsets), ids=np.array(ids),
             raw=np.array(raw_counts))
    print('CACHE', len(ids), 'clips', flush=True)


def window(clip: np.ndarray, rng) -> np.ndarray:
    if rng is None:
        return resample(clip, T)
    # The browser samples the camera every 100 ms (~10 fps); Slovo is ~30 fps.
    stride = int(rng.choice([1, 2, 3, 3, 4]))
    clip = clip[int(rng.integers(0, stride)):][::stride]
    if len(clip) < 4:
        return resample(clip if len(clip) else np.zeros((1, CHANNELS), np.float32), T)
    n = len(clip)
    a = int(rng.integers(0, max(1, int(.12 * n)) + 1))
    b = n - int(rng.integers(0, max(1, int(.12 * n)) + 1))
    if b - a < 4:
        a, b = 0, n
    return resample(clip[a:b], T)


def augment(w: np.ndarray, rng) -> np.ndarray:
    w = w.astype(np.float32).copy()
    rot = rotation(rng, (15, 15, 15))
    zoom = rng.uniform(.85, 1.15)
    shift = rng.normal(0, .25, 2)
    for k in range(2):
        b = k * 66
        on = w[:, b + 65] > 0
        shape = w[:, b:b + 63].reshape(T, 21, 3) @ rot.T
        shape = shape * rng.uniform(.95, 1.05) + rng.normal(0, .02, shape.shape)
        w[:, b:b + 63] = shape.reshape(T, 63)
        w[:, b + 63:b + 65] = w[:, b + 63:b + 65] * zoom + shift + rng.normal(0, .03, (T, 2))
        if rng.random() < .3:
            drop = rng.random(T) < .15
            w[drop, b:b + 66] = 0
            on &= ~drop
        w[~on, b:b + 66] = 0
    both = (w[:, 65] > 0) & (w[:, 131] > 0)
    w[:, 132:134] = np.where(both[:, None], w[:, 132:134] * zoom, 0)
    return w


def topk(p, y, k):
    return float(np.mean([y[i] in np.argsort(p[i])[-k:] for i in range(len(y))]))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output', type=Path, default=DATA / 'slovo-word-v2')
    ap.add_argument('--cache', type=Path, default=DATA / 'slovo-word-features-v3.npz')
    ap.add_argument('--protocol', choices=['signer-hash', 'official'], default='signer-hash')
    ap.add_argument('--epochs', type=int, default=70)
    ap.add_argument('--width', type=int, default=192)
    ap.add_argument('--refit', action='store_true', help='retrain on fit+validation before test')
    ap.add_argument('--seed', type=int, default=42)
    ap.add_argument('--final-only', action='store_true', help='skip the selection run; train once on fit+validation')
    args = ap.parse_args()
    started = time.monotonic()
    if not args.cache.exists():
        build_cache(args.cache)
    d = np.load(args.cache)
    x_all, offsets, ids = d['x'], d['offsets'], d['ids']
    clips = [x_all[offsets[i]:offsets[i + 1]] for i in range(len(ids))]
    meta = {r['attachment_id']: r for r in csv.DictReader(
        (DATA / 'slovo-annotations.csv').read_text().splitlines(), delimiter='\t')}
    rows = [meta[i] for i in ids]
    labels = sorted({r['text'] for r in rows})
    y = np.array([labels.index(r['text']) for r in rows])
    users = np.array([r['user_id'] for r in rows])
    bucket = np.array([int(hashlib.sha256(u.encode()).hexdigest()[:8], 16) % 10 for u in users])
    if args.protocol == 'signer-hash':
        test, val = bucket < 2, bucket == 2
    else:
        official_test = np.array([r['train'] != 'True' for r in rows])
        clean = ~official_test & ~np.isin(users, list(set(users[official_test])))
        test = official_test
        val = clean & (bucket % 5 == 0)
        assert clean.sum() > 0
        val &= clean
    fit = ~test & ~val if args.protocol == 'signer-hash' else (clean & ~val)
    for a, b in ((fit, val), (fit, test), (val, test)):
        assert not set(users[a]) & set(users[b]), 'signer overlap'
    catalog = json.loads((ROOT / 'frontend/public/research/rsl/words/catalog.json').read_text())
    catalog = catalog.get('words', catalog) if isinstance(catalog, dict) else catalog
    course_texts = sorted({meta[w['attachmentId']]['text'] for w in catalog if w.get('attachmentId') in meta})
    course = np.array([labels.index(t) for t in course_texts])
    print(json.dumps(dict(fit=int(fit.sum()), val=int(val.sum()), test=int(test.sum()), labels=len(labels),
                          signers=[len(set(users[m])) for m in (fit, val, test)], course=len(course))), flush=True)

    rng = np.random.default_rng(0)
    sample = np.stack([window(clips[i], None) for i in np.flatnonzero(fit)[:4000]]).reshape(-1, CHANNELS)
    mean = sample.mean(0)
    std = np.maximum(sample.std(0), .05)
    device = 'mps' if torch.backends.mps.is_available() else 'cpu'

    def evaluate(model, mask):
        idx = np.flatnonzero(mask)
        xs = np.stack([window(clips[i], None) for i in idx]).astype(np.float32)
        with torch.no_grad():
            p = torch.softmax(model(torch.tensor((xs - mean) / std, device=device)), 1).cpu().numpy()
        return p, y[idx], xs

    def train(mask, seed):
        torch.manual_seed(seed)
        r = np.random.default_rng(seed)
        model = SeqNet(CHANNELS, len(labels), width=args.width, hidden=384, dropout=.3).to(device)
        opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=5e-3)
        idx = np.flatnonzero(mask)
        steps = (len(idx) + 255) // 256
        sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=3e-3, total_steps=args.epochs * steps)
        loss_fn = nn.CrossEntropyLoss(label_smoothing=.1)
        for epoch in range(args.epochs):
            r.shuffle(idx)
            model.train()
            total = 0.
            for s in range(steps):
                b = idx[s * 256:(s + 1) * 256]
                xb = np.stack([augment(window(clips[i], r), r) for i in b])
                xb = torch.tensor((xb - mean) / std, dtype=torch.float32, device=device)
                opt.zero_grad()
                loss = loss_fn(model(xb), torch.tensor(y[b], device=device))
                loss.backward()
                opt.step()
                sched.step()
                total += loss.item()
            if epoch % 5 == 0 or epoch == args.epochs - 1:
                model.eval()
                p, yy, _ = evaluate(model, val)
                print(f'epoch {epoch} loss {total / steps:.3f} val top1 {np.mean(p.argmax(1) == yy):.3f} '
                      f'{round(time.monotonic() - started)}s', flush=True)
        return model.eval()

    model = train(fit | val, args.seed) if args.final_only else train(fit, args.seed)
    vp, vy, _ = evaluate(model, val)
    in_course = np.isin(vy, course)
    thresholds = []
    for t in (.2, .3, .4, .5, .6, .7, .8):
        ranked = np.sort(vp, 1)
        acc = (ranked[:, -1] >= t) & (ranked[:, -1] - ranked[:, -2] >= .1)
        ok = vp.argmax(1) == vy
        thresholds.append(dict(threshold=t, coverage=float(acc[in_course].mean()),
                               precision=float(ok[acc & in_course].mean()) if (acc & in_course).any() else 0.))
    good = [s for s in thresholds if s['precision'] >= .9]
    threshold = max(good, key=lambda s: s['coverage'])['threshold'] if good else .8
    if args.refit and not args.final_only:
        model = train(fit | val, args.seed)
    exported = export(model.cpu(), mean, std, labels, frames=T, threshold=threshold, margin=.1,
                      kind='slovo-word-v2', courseLabels=course_texts)
    device = 'cpu'
    tp, ty, tx = evaluate(model.cpu(), test)

    def summary(p, yy):
        ranked = np.sort(p, 1)
        acc = (ranked[:, -1] >= threshold) & (ranked[:, -1] - ranked[:, -2] >= .1)
        ok = p.argmax(1) == yy
        return dict(clips=int(len(yy)), top1=float(ok.mean()), top5=topk(p, yy, 5),
                    macroTop1=float(np.mean([ok[yy == c].mean() for c in np.unique(yy)])),
                    acceptedCoverage=float(acc.mean()), acceptedPrecision=float(ok[acc].mean()) if acc.any() else 0.)

    m = np.isin(ty, course)
    restricted = tp[m][:, course]
    course_y = np.searchsorted(course, ty[m])
    report = dict(
        protocol=args.protocol, scope='Slovo clips, signer-disjoint; isolated signs, not continuous phrases',
        split=dict(fit=int(fit.sum()), validation=int(val.sum()), test=int(test.sum()),
                   fitSigners=len(set(users[fit])), validationSigners=len(set(users[val])),
                   testSigners=len(set(users[test]))),
        model=dict(**model.spec, epochs=args.epochs, frames=T, refit=args.refit),
        validationThresholds=thresholds, threshold=threshold,
        testAll1000=summary(tp, ty),
        testCourseWords=dict(**summary(tp[m], ty[m]),
                             top1AmongCourseOnly=float(np.mean(restricted.argmax(1) == course_y)),
                             top3AmongCourseOnly=topk(restricted, course_y, 3)),
        perCourseWord={labels[c]: dict(clips=int((ty == c).sum()), correct=int(((ty == c) & (tp.argmax(1) == c)).sum()))
                       for c in course},
        seconds=round(time.monotonic() - started))
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / 'classifier.json').write_text(json.dumps(exported, ensure_ascii=False))
    (args.output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    fx = [dict(features=tx[i].tolist(), probabilities=reference_forward(exported, tx[i]).tolist())
          for i in range(0, len(tx), max(1, len(tx) // 6))][:6]
    (args.output / 'fixtures.json').write_text(json.dumps(fx))
    print(json.dumps({k: v for k, v in report.items() if k not in ('perCourseWord', 'validationThresholds')},
                     ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
