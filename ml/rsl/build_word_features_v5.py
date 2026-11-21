"""Word features v5 = v3 hand features + BODY channels from data/slovo-pose.
Same clips and order rules as train_slovo_v2.build_cache.
  .venv/bin/python build_word_features_v5.py  → data/slovo-word-features-v5.npz
"""
import csv, time
from pathlib import Path
import ijson, numpy as np
from word_features import clip_features

DATA = Path(__file__).resolve().parents[2] / 'ml/rsl/data'
POSE = DATA / 'slovo-pose'
meta = {r['attachment_id']: r for r in csv.DictReader((DATA / 'slovo-annotations.csv').read_text().splitlines(), delimiter='\t')}
chunks, offsets, ids, raw, found = [], [0], [], [], []
t0 = time.monotonic()
with (DATA / 'slovo_mediapipe.json').open('rb') as f:
    for n, (cid, frames) in enumerate(ijson.kvitems(f, '', use_float=True), 1):
        r = meta.get(cid)
        if r is None or r['text'] == 'no_event' or not (POSE / (cid + '.npz')).exists():
            continue
        hands = [[np.array([[p['x'], p['y'], p['z']] for p in pts]) for _, pts in (fr or {}).items()
                  if isinstance(pts, list) and len(pts) == 21] for fr in frames]
        pose = np.load(POSE / (cid + '.npz'))['pose']
        if len(pose) < len(frames):  # a decoder may drop the last frame or two
            pose = np.concatenate([pose, np.zeros((len(frames) - len(pose), 9, 3), np.float32)])
        feats = clip_features(hands, float(r['width']), float(r['height']), pose[:len(frames)])
        if feats is None or len(feats) < 4:
            continue
        chunks.append(feats.astype(np.float16)); offsets.append(offsets[-1] + len(feats)); ids.append(cid); raw.append(len(frames))
        found.append(float(feats[:, -1].mean()))
        if n % 2000 == 0:
            print('PARSED', n, len(ids), round(time.monotonic() - t0), flush=True)
np.savez(DATA / 'slovo-word-features-v5.npz', x=np.concatenate(chunks), offsets=np.array(offsets), ids=np.array(ids), raw=np.array(raw))
print('CACHE_V5', len(ids), 'clips, body found in', round(float(np.mean(found)), 3), flush=True)
