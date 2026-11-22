"""Word recognizer v6 = v5 + 21 face channels (face_features.py: mouthing, brows,
eyes, head pose). v5 notes: Word recognizer v5 = v4 + 13 body channels (word_features.BODY): where each
hand is relative to shoulders, nose and mouth. Same split, args and negatives.

v4 notes: Word recognizer v4 = v3 with tunable size/schedule and a validation mode.
--val trains on signer buckets 4-9 and scores buckets 2-3 (model selection
never looks at the test buckets 0-1). Original v3 notes:

Word recognizer v3: v2 + an explicit "__none__" class for continuous use.

v2 only ever saw cleanly trimmed whole signs, so on a live stream it had to
name *some* word for resting hands, half signs and transitions. v3 adds
negatives built from the same signer's clips:
  * rest: one frame held 1-2 s with landmark jitter,
  * partial: only the first or last 20-40 % of a sign,
  * transition: last 40 % of sign A followed by the first 40 % of sign B,
and positives with up to 25 % of a neighbouring sign attached (sloppy
boundaries). Same signer-hash split as v2; test signers are never trained on.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn

from seqnet import SeqNet, export
import train_slovo_v2
from train_slovo_v2 import DATA, ROOT, T, topk, window
from word_features import BODY, FACE, CHANNELS as HAND_CHANNELS, resample

CHANNELS = HAND_CHANNELS + BODY + FACE
train_slovo_v2.CHANNELS = CHANNELS  # window() pads empty clips with this width


def augment(w, rng):
    out = w.astype(np.float32).copy()
    out[:, :HAND_CHANNELS] = train_slovo_v2.augment(w[:, :HAND_CHANNELS], rng)
    b = out[:, HAND_CHANNELS:HAND_CHANNELS + BODY]
    ok = b[:, -1] > 0
    if rng.random() < .15:
        b[:] = 0  # pose not found / camera too close
    else:
        b[:, :-1] = b[:, :-1] * rng.uniform(.88, 1.12) + rng.normal(0, .04, (1, BODY - 1)) + rng.normal(0, .015, (len(b), BODY - 1))
        for k in range(2):  # no body position for a hand that is not there
            b[out[:, k * 66 + 65] <= 0, k * 6:k * 6 + 6] = 0
        b[~ok] = 0
    f = out[:, HAND_CHANNELS + BODY:]
    seen = f[:, -1] > 0
    if rng.random() < .15:
        f[:] = 0  # face not found
    else:
        f[:, :17] = np.clip(f[:, :17] * rng.uniform(.85, 1.15) + rng.normal(0, .03, (len(f), 17)), 0, 1)
        f[:, 17:20] += rng.normal(0, .04, (1, 3)) + rng.normal(0, .01, (len(f), 3))
        f[~seen] = 0
    return out

NONE = '__none__'


def rest_clip(clip, rng):
    on = np.flatnonzero((clip[:, 65] > 0) | (clip[:, 131] > 0))
    f = clip[on[0] if rng.random() < .5 else on[-1]].astype(np.float32)
    n = int(rng.integers(20, 41))
    out = np.repeat(f[None], n, 0)
    out[:, :132] += rng.normal(0, .02, (n, 132)).astype(np.float32) * (out[:, :132] != 0)
    f = out[:, HAND_CHANNELS + BODY:]
    seen = f[:, -1] > 0
    if rng.random() < .15:
        f[:] = 0  # face not found
    else:
        f[:, :17] = np.clip(f[:, :17] * rng.uniform(.85, 1.15) + rng.normal(0, .03, (len(f), 17)), 0, 1)
        f[:, 17:20] += rng.normal(0, .04, (1, 3)) + rng.normal(0, .01, (len(f), 3))
        f[~seen] = 0
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output', type=Path, default=DATA / 'slovo-word-v6')
    ap.add_argument('--epochs', type=int, default=70)
    ap.add_argument('--seed', type=int, default=42)
    ap.add_argument('--neg', type=float, default=.25, help='fraction of negatives per batch')
    ap.add_argument('--width', type=int, default=192)
    ap.add_argument('--hidden', type=int, default=384)
    ap.add_argument('--blocks', default='5x1,5x2,5x4')
    ap.add_argument('--dropout', type=float, default=.3)
    ap.add_argument('--smooth', type=float, default=.1)
    ap.add_argument('--lr', type=float, default=3e-3)
    ap.add_argument('--val', action='store_true')
    args = ap.parse_args()
    started = time.monotonic()
    d = np.load(DATA / 'slovo-word-features-v6.npz')
    x_all, offsets, ids = d['x'], d['offsets'], d['ids']
    clips = [x_all[offsets[i]:offsets[i + 1]].astype(np.float32) for i in range(len(ids))]
    meta = {r['attachment_id']: r for r in csv.DictReader(
        (DATA / 'slovo-annotations.csv').read_text().splitlines(), delimiter='\t')}
    rows = [meta[i] for i in ids]
    signs = sorted({r['text'] for r in rows})
    labels = signs + [NONE]
    y = np.array([signs.index(r['text']) for r in rows])
    users = np.array([r['user_id'] for r in rows])
    bucket = np.array([int(hashlib.sha256(u.encode()).hexdigest()[:8], 16) % 10 for u in users])
    test, train = bucket < 2, bucket >= 2
    if args.val:
        test, train = (bucket >= 2) & (bucket < 4), bucket >= 4
    assert not set(users[test]) & set(users[train])
    by_user = {}
    for i in np.flatnonzero(train):
        by_user.setdefault(users[i], []).append(i)
    catalog = json.loads((ROOT / 'frontend/public/research/rsl/words/catalog.json').read_text())
    course_texts = sorted({meta[w['attachmentId']]['text'] for w in catalog if w.get('attachmentId') in meta})
    course = np.array([labels.index(t) for t in course_texts])

    rng = np.random.default_rng(args.seed)
    torch.manual_seed(args.seed)
    sample = np.stack([window(clips[i], None) for i in np.flatnonzero(train)[:4000]]).reshape(-1, CHANNELS)
    mean, std = sample.mean(0), np.maximum(sample.std(0), .05)
    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    model = SeqNet(CHANNELS, len(labels), width=args.width, hidden=args.hidden,
                   blocks=tuple(tuple(int(v) for v in b.split('x')) for b in args.blocks.split(',')), dropout=args.dropout).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=5e-3)
    idx = np.flatnonzero(train)
    steps = (len(idx) + 255) // 256
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=args.epochs * steps)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=args.smooth)
    none = len(labels) - 1

    def neighbour(i):
        same = by_user[users[i]]
        return clips[same[int(rng.integers(len(same)))]]

    def example(i):
        c = clips[i]
        if rng.random() < args.neg:
            kind = rng.random()
            if kind < .35:
                return rest_clip(c, rng), none
            n = len(c)
            if kind < .65:
                k = max(2, int(n * rng.uniform(.2, .4)))
                return (c[:k] if rng.random() < .5 else c[-k:]), none
            o = neighbour(i)
            return np.concatenate([c[-max(2, int(.4 * n)):], o[:max(2, int(.4 * len(o)))]]), none
        if rng.random() < .3:
            o = neighbour(i)
            k = max(1, int(len(o) * rng.uniform(.05, .25)))
            c = np.concatenate([o[-k:], c]) if rng.random() < .5 else np.concatenate([c, o[:k]])
        return c, y[i]

    for epoch in range(args.epochs):
        rng.shuffle(idx)
        model.train()
        total = 0.
        for s in range(steps):
            batch = [example(i) for i in idx[s * 256:(s + 1) * 256]]
            xb = np.stack([augment(window(c, rng), rng) for c, _ in batch])
            yb = torch.tensor([l for _, l in batch], device=device)
            opt.zero_grad()
            loss = loss_fn(model(torch.tensor((xb - mean) / std, dtype=torch.float32, device=device)), yb)
            loss.backward()
            opt.step()
            sched.step()
            total += loss.item()
        if epoch % 10 == 0 or epoch == args.epochs - 1:
            print(f'epoch {epoch} loss {total / steps:.3f} {round(time.monotonic() - started)}s', flush=True)

    model = model.eval().cpu()
    tx = np.stack([window(clips[i], None) for i in np.flatnonzero(test)]).astype(np.float32)
    ty = y[test]
    with torch.no_grad():
        p = torch.softmax(model(torch.tensor((tx - mean) / std)), 1).numpy()
    signs_p = p[:, :-1]
    m = np.isin(ty, course)
    restricted = signs_p[m][:, course]
    cy = np.searchsorted(course, ty[m])
    report = dict(
        scope='Slovo signer-disjoint test (same split as v2); __none__ trained on synthetic rest/partial/transition windows',
        test=dict(top1All=float((signs_p.argmax(1) == ty).mean()), top5All=topk(signs_p, ty, 5),
                  courseTop1=float((restricted.argmax(1) == cy).mean()), courseTop3=topk(restricted, cy, 3),
                  noneOnRealSigns=float((p.argmax(1) == none).mean())),
        split='validation buckets 2-3' if args.val else 'test buckets 0-1', args=vars(args) | {'output': str(args.output)},
        epochs=args.epochs, seed=args.seed, seconds=round(time.monotonic() - started))
    exported = export(model, mean, std, labels, frames=T, threshold=.5, margin=.2,
                      kind='slovo-word-v6', courseLabels=course_texts, noneLabel=NONE)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / 'classifier.json').write_text(json.dumps(exported, ensure_ascii=False))
    (args.output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
