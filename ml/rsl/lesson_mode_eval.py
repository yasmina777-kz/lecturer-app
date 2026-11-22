"""Lesson mode: the camera exercise ranks only the 8 words of the lesson.
Held-out test signers, words v5 ensemble; per clip the choices are the
trainer lesson that contains the word (catalog order, 8 per lesson).
  .venv/bin/python lesson_mode_eval.py"""
import csv, hashlib, json
from collections import defaultdict
from pathlib import Path
import numpy as np
from seqnet import reference_forward
from word_features import resample

ROOT = Path(__file__).resolve().parents[2]; DATA = ROOT / 'ml/rsl/data'
meta = {r['attachment_id']: r for r in csv.DictReader((DATA / 'slovo-annotations.csv').read_text().splitlines(), delimiter='\t')}
catalog = json.loads((ROOT / 'frontend/public/research/rsl/words/catalog.json').read_text())
by_cat = defaultdict(list)
for w in catalog:
    if w.get('attachmentId') in meta: by_cat[w['category']].append(meta[w['attachmentId']]['text'])
lesson_of = {}
for cat, ws in by_cat.items():
    for i in range(0, len(ws), 8):
        for t in ws[i:i + 8]: lesson_of.setdefault(t, ws[i:i + 8])
d = np.load(DATA / 'slovo-word-features-v5.npz'); x, off, ids = d['x'], d['offsets'], d['ids']
ex = [json.loads((DATA / f'slovo-word-v5-seed{s}' / 'classifier.json').read_text()) for s in (42, 7, 1234)]
labels = ex[0]['labels']
rows = []
for i, a in enumerate(ids):
    r = meta[a]
    if int(hashlib.sha256(r['user_id'].encode()).hexdigest()[:8], 16) % 10 >= 2 or r['text'] not in lesson_of: continue
    ch = [t for t in lesson_of[r['text']] if t in labels]
    if len(ch) < 2: continue
    p = np.mean([reference_forward(e, resample(x[off[i]:off[i + 1]].astype(np.float32), 32)) for e in ex], 0)
    q = np.array([p[labels.index(t)] for t in ch]); q = q / q.sum(); o = np.argsort(-q)
    rows.append((ch[o[0]] == r['text'], q[o[0]], q[o[0]] - q[o[1]]))
R = np.array(rows, dtype=float)
print('clips', len(R), 'top1 among lesson words', round(R[:, 0].mean(), 3))
for th, mg in [(0.4, 0.2), (0.5, 0.2), (0.6, 0.3), (0.7, 0.4)]:
    acc = (R[:, 1] >= th) & (R[:, 2] >= mg)
    print(f'th={th} margin={mg}: accepted {acc.mean():.3f}, correct among accepted {R[acc, 0].mean():.3f}, wrong accepted {(acc & (R[:, 0] == 0)).mean():.3f}')
