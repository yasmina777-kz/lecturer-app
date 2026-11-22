"""How much does the browser's stale body pose hurt words v5?
The browser runs hand tracking every frame but pose only every 500 ms and
reuses the last pose in between. Simulate that on held-out test signers.
  .venv/bin/python pose_lag_eval.py"""
import csv, hashlib, json
from pathlib import Path
import ijson, numpy as np
from seqnet import reference_forward
from word_features import clip_features, resample

DATA = Path(__file__).resolve().parents[2] / 'ml/rsl/data'
POSE = DATA / 'slovo-pose'
meta = {r['attachment_id']: r for r in csv.DictReader((DATA / 'slovo-annotations.csv').read_text().splitlines(), delimiter='\t')}
test = lambda r: int(hashlib.sha256(r['user_id'].encode()).hexdigest()[:8], 16) % 10 < 2
ex = [json.loads((DATA / f'slovo-word-v5-seed{s}' / 'classifier.json').read_text()) for s in (42, 7, 1234)]
labels = ex[0]['labels']
HOLDS = [1, 15]  # 1 = pose every frame (training); 15 ≈ 500 ms at 30 fps
hits = {h: 0 for h in HOLDS}; n = 0
with (DATA / 'slovo_mediapipe.json').open('rb') as f:
    for cid, frames in ijson.kvitems(f, '', use_float=True):
        r = meta.get(cid)
        if r is None or r['text'] == 'no_event' or not test(r) or r['text'] not in labels or not (POSE / (cid + '.npz')).exists():
            continue
        hands = [[np.array([[p['x'], p['y'], p['z']] for p in pts]) for _, pts in (fr or {}).items()
                  if isinstance(pts, list) and len(pts) == 21] for fr in frames]
        pose = np.load(POSE / (cid + '.npz'))['pose']
        if len(pose) < len(frames):
            pose = np.concatenate([pose, np.zeros((len(frames) - len(pose), 9, 3), np.float32)])
        pose = pose[:len(frames)]
        y = labels.index(r['text']); ok = True
        for h in HOLDS:
            held = pose[(np.arange(len(pose)) // h) * h]
            feats = clip_features(hands, float(r['width']), float(r['height']), held)
            if feats is None or len(feats) < 4:
                ok = False; break
            w = resample(feats.astype(np.float32), 32)
            p = np.mean([reference_forward(e, w) for e in ex], 0)
            hits[h] += int(p[:-1].argmax() == y) if len(p) > len(labels) - 1 else int(p.argmax() == y)
        if ok: n += 1
        if n and n % 500 == 0: print('progress', n, {h: round(hits[h] / n, 4) for h in HOLDS}, flush=True)
        if n >= 2000: break
print('RESULT clips', n, {('every frame' if h == 1 else 'pose every 500 ms'): round(hits[h] / n, 4) for h in HOLDS}, flush=True)
