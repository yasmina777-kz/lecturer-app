"""v6 letter recognizer: the v5 hand sequence + where the hand is on the body.

Per frame: the 66 hand channels of v5 (temporal.ts temporalFrame) plus 9 body
channels from MediaPipe Pose (bodyFrame in temporal.ts): the hand's wrist
relative to the shoulders, nose and mouth, the elbow on that side, all in
shoulder widths (mirrored for left hands like the hand), and a body flag.
Body is dropped at random in training, so the model still works when the pose
is not found. Same signer splits and test set as v5; the acceptance threshold
is chosen on validation signers with the live-stream replay, not per clip.
  .venv/bin/python train_alphabet_v6.py [--output data/alphabet-v6]
"""
from __future__ import annotations
import argparse, hashlib, json, time
from pathlib import Path
import cv2
import numpy as np
import torch
from torch import nn

from seqnet import SeqNet, export, reference_forward
import train_alphabet_v5 as v5
from train_alphabet_v5 import LABELS, NO_EVENT, T, whole_clip, stream_window, metrics, per_class

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'ml/rsl/data/alphabet'
POSE = DATA / 'pose-v6'
HAND, BODY = 66, 9
C = HAND + BODY


def body_features(hand: np.ndarray, pose: np.ndarray, aspect: float) -> np.ndarray:
    """Python twin of temporal.ts bodyFrame. pose: 9×(x, y, visibility) =
    nose, mouth L/R, shoulders L/R, elbows L/R, wrists L/R (image coords)."""
    if hand[65] <= 0 or pose[3, 2] < .5 or pose[4, 2] < .5:
        return np.zeros(BODY, np.float32)
    flip = -1. if hand[63] < 0 else 1.
    P = pose[:, :2] * np.array([aspect, 1.])
    w = np.array([hand[63] * flip * aspect, hand[64]])
    sm, sw = (P[3] + P[4]) / 2, float(np.linalg.norm(P[3] - P[4]))
    if sw < 1e-3:
        return np.zeros(BODY, np.float32)
    elbow = P[5] if np.linalg.norm(P[7] - w) <= np.linalg.norm(P[8] - w) else P[6]
    m = np.array([flip, 1.]) / sw
    mouth = (P[1] + P[2]) / 2
    return np.r_[(w - sm) * m, (w - P[0]) * m, (w - mouth) * m, (elbow - sm) * m, 1.].astype(np.float32)


def normalize(w: np.ndarray) -> np.ndarray:
    a = np.zeros((len(w), C), np.float32)
    a[:, :HAND] = v5.normalize_window(w[:, :HAND])
    b = w[:, HAND:].astype(np.float64)
    ok = b[:, -1] > 0
    if ok.any():
        idx = np.flatnonzero(ok)
        for c in range(BODY - 1):
            b[:, c] = np.interp(np.arange(len(b)), idx, b[idx, c])
        b[:, -1] = ok
    else:
        b[:] = 0
    a[:, HAND:] = b
    return a


def augment(w, rng):
    out = w.copy()
    out[:, :HAND] = v5.augment(w[:, :HAND], rng)
    b = out[:, HAND:]
    ok = b[:, -1] > 0
    if rng.random() < .15:
        b[:] = 0  # pose not found
    elif ok.any():
        b[:, :-1] *= rng.uniform(.88, 1.12)
        b[:, :-1] += rng.normal(0, .04, (1, BODY - 1)) + rng.normal(0, .015, (len(b), BODY - 1))
        b[~ok] = 0
    out[out[:, 65] <= 0, HAND:] = 0
    return out


def aspect_of(aid):
    cap = cv2.VideoCapture(str(DATA / (aid + '.mp4')))
    w, h = cap.get(cv2.CAP_PROP_FRAME_WIDTH), cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    cap.release()
    return w / h if h else 1.


def load(rows):
    clips = []
    for r in rows:
        d = np.load(v5.CACHE / (r['attachment_id'] + '.npz'))
        pose = np.load(POSE / (r['attachment_id'] + '.npz'))['pose']
        hand = d['frames']
        n = min(len(hand), len(pose))
        asp = aspect_of(r['attachment_id'])
        body = np.stack([body_features(hand[i], pose[i], asp) for i in range(n)])
        clips.append((np.c_[hand[:n], body], d['times'][:n], LABELS.index(r['text']), r['user_id']))
    return clips


def batch(clips, rng, per_clip):
    xs, ys = [], []
    for frames, times, y, _ in clips:
        for k in range(per_clip):
            w = whole_clip(frames) if k == 0 else stream_window(frames, times, rng)
            xs.append(normalize(augment(w, rng)))
            ys.append(y)
    return np.stack(xs), np.array(ys)


def stream(clips, predict, threshold, margin=.2, agree=2):
    res = []
    for frames, times, y, _ in clips:
        dur = float(times[-1])
        starts = np.arange(0, max(0., dur - 1500) + 1, 400) if dur > 1500 else [0.]
        ws = np.stack([normalize(stream_window(frames, times, None, 100., s)) for s in starts])
        p = predict(ws)
        pred, rk = p.argmax(1), np.sort(p, 1)
        ok = (rk[:, -1] >= threshold) & (rk[:, -1] - rk[:, -2] >= margin) & (pred != NO_EVENT) & ((ws[:, :, 65] > 0).sum(1) >= 8)
        em = None
        for i in range(len(pred)):
            if ok[i] and (agree == 1 or len(pred) == 1 or (i > 0 and ok[i - 1] and pred[i - 1] == pred[i])):
                em = int(pred[i]); break
        res.append((y, em))
    sg = [(y, e) for y, e in res if y != NO_EVENT]
    return dict(clips=len(sg), emitted=sum(e is not None for _, e in sg), correct=sum(e == y for y, e in sg),
                wrong=sum(e is not None and e != y for y, e in sg), noEventFalseEmits=sum(e is not None for y, e in res if y == NO_EVENT))


def predictor(model, mean, std):
    def run(w):
        with torch.no_grad():
            return torch.softmax(model(torch.tensor((w - mean) / std, dtype=torch.float32)), 1).numpy()
    return run


def train(fit, mean, std, seed, epochs, width):
    torch.manual_seed(seed)
    rng = np.random.default_rng(seed)
    model = SeqNet(C, len(LABELS), width=width, hidden=256, dropout=.25)
    opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-3)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=3e-3, total_steps=epochs * 40)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=.1)
    for epoch in range(epochs):
        x, y = batch(fit, rng, 4)
        x, y = torch.tensor((x - mean) / std, dtype=torch.float32), torch.tensor(y)
        model.train(); total = 0.
        for chunk in torch.randperm(len(y)).tensor_split(40):
            opt.zero_grad(); loss = loss_fn(model(x[chunk]), y[chunk]); loss.backward(); opt.step(); sched.step(); total += loss.item()
        if epoch % 10 == 0 or epoch == epochs - 1:
            print(f'seed {seed} epoch {epoch} loss {total / 40:.3f}', flush=True)
    return model.eval()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--output', type=Path, default=ROOT / 'ml/rsl/data/alphabet-v6')
    ap.add_argument('--epochs', type=int, default=90)
    ap.add_argument('--width', type=int, default=128)
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    t0 = time.monotonic()
    raw = (DATA / 'manifest.json').read_bytes()
    rows = [r for r in json.loads(raw) if (v5.CACHE / (r['attachment_id'] + '.npz')).exists() and (POSE / (r['attachment_id'] + '.npz')).exists()]
    tr = {r['user_id'] for r in rows if r['train'] == 'True'}
    val = {u for u in tr if int(hashlib.sha256(u.encode()).hexdigest()[:8], 16) % 5 == 0}
    split = lambda r: 'test' if r['train'] == 'False' else 'validation' if r['user_id'] in val else 'fit'
    sets = {s: load([r for r in rows if split(r) == s]) for s in ('fit', 'validation', 'test')}
    print({k: len(v) for k, v in sets.items()}, 'body found in', round(float(np.mean([c[0][:, -1].mean() for c in sets['fit']])), 3), flush=True)
    sample, _ = batch(sets['fit'], np.random.default_rng(0), 2)
    mean, std = sample.reshape(-1, C).mean(0), np.maximum(sample.reshape(-1, C).std(0), .05)

    model = train(sets['fit'], mean, std, 42, args.epochs, args.width)
    pv = predictor(model, mean, std)
    # Threshold for the LIVE stream: most letters shown, ≤ 2.5% of shown ones wrong.
    grid = []
    for th in (.35, .4, .45, .5, .55, .6, .7):
        for mg in (.1, .15, .2):
            for ag in (1, 2):
                s = stream(sets['validation'], pv, th, mg, ag)
                grid.append(dict(threshold=th, margin=mg, agree=ag, **s))
    ok = [g for g in grid if g['wrong'] <= .025 * max(g['emitted'], 1) and g['noEventFalseEmits'] <= 1]
    pick = max(ok or grid, key=lambda g: (g['correct'], -g['wrong']))
    print('validation stream pick', pick, flush=True)

    final = train(sets['fit'] + sets['validation'], mean, std, 42, args.epochs, args.width)
    exported = export(final, mean, std, LABELS, frames=T, threshold=pick['threshold'], margin=pick['margin'], agree=pick['agree'],
                      kind='temporal-alphabet-v6', input='temporalFrame+bodyFrame-normalized')
    serve = lambda w: np.stack([reference_forward(exported, x) for x in w])
    tx = np.stack([normalize(whole_clip(f)) for f, _, _, _ in sets['test']])
    ty = np.array([y for _, _, y, _ in sets['test']])
    tp = serve(tx)
    report = dict(
        scope='Bukva official test signers (same clips as v5)', splitCounts={k: len(v) for k, v in sets.items()},
        model=dict(**final.spec, epochs=args.epochs), pick=pick,
        test=dict(clip=metrics(tp, ty, (tx[:, :, 65] > 0).mean(1), pick['threshold'], pick['margin']),
                  stream=stream(sets['test'], serve, pick['threshold'], pick['margin'], pick['agree']),
                  streamAtV5Settings=stream(sets['test'], serve, .6, .2, 2)),
        perClass=per_class(tp, ty, pick['threshold'], pick['margin']), seconds=round(time.monotonic() - t0))
    raw_test = np.stack([whole_clip(f) for f, _, _, _ in sets['test']])
    (args.output / 'classifier.json').write_text(json.dumps(exported, ensure_ascii=False))
    (args.output / 'fixtures.json').write_text(json.dumps([dict(frames=raw_test[i].tolist(), probabilities=tp[i].tolist()) for i in range(0, len(raw_test), 51)]))
    (args.output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k != 'perClass'}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
