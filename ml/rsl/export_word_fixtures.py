"""Write raw-landmark -> feature -> probability fixtures for the browser parity check.

Uses a few signer-disjoint *test* clips from the Slovo keypoint release.
"""
import csv
import hashlib
import json
import sys
from pathlib import Path

import ijson
import numpy as np

from seqnet import reference_forward
from word_features import clip_features, resample

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'ml/rsl/data'
model_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DATA / 'slovo-word-v2/classifier.json'
out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'frontend/public/models/rsl/words-v2-feature-fixtures.json'
model = json.loads(model_path.read_text())
BODY = model['channels'] > 134  # v5: hands + body (poses from data/slovo-pose)
rows = {r['attachment_id']: r for r in csv.DictReader((DATA / 'slovo-annotations.csv').read_text().splitlines(), delimiter='\t')}
fixtures = []
with (DATA / 'slovo_mediapipe.json').open('rb') as f:
    for clip_id, frames in ijson.kvitems(f, '', use_float=True):
        r = rows.get(clip_id)
        if not r or r['text'] == 'no_event':
            continue
        if int(hashlib.sha256(r['user_id'].encode()).hexdigest()[:8], 16) % 10 >= 2:
            continue  # test signers only
        hands = [[[[p['x'], p['y'], p['z']] for p in pts] for pts in (fr or {}).values()
                  if isinstance(pts, list) and len(pts) == 21] for fr in frames]
        if len(fixtures) % 2 == 0 and not any(len(h) == 2 for h in hands):
            continue  # include two-hand clips
        pose = None
        if BODY:
            pp = DATA / 'slovo-pose' / (clip_id + '.npz')
            if not pp.exists():
                continue
            pose = np.load(pp)['pose']
            if len(pose) < len(hands):
                pose = np.concatenate([pose, np.zeros((len(hands) - len(pose), 9, 3), np.float32)])
            pose = pose[:len(hands)]
        feats = clip_features([[np.array(h) for h in fr] for fr in hands], float(r['width']), float(r['height']), pose)
        if feats is None:
            continue
        fixtures.append(dict(id=clip_id, label=r['text'], width=float(r['width']), height=float(r['height']),
                             hands=hands[:60], features=None))
        if BODY:
            fixtures[-1]['poses'] = pose[:60].round(5).tolist()
        # Recompute on the truncated frame list actually stored.
        feats = clip_features([[np.array(h) for h in fr] for fr in hands[:60]], float(r['width']), float(r['height']),
                              None if pose is None else np.round(pose[:60], 5))
        fixtures[-1]['features'] = feats.tolist()
        fixtures[-1]['probabilities'] = reference_forward(model, resample(feats, 32)).tolist()
        if len(fixtures) == 6:
            break
out_path.write_text(json.dumps(fixtures))
print('fixtures', [(f['label'], len(f['features'])) for f in fixtures])
