"""bodyFrame parity fixtures (Python body_features vs temporal.ts bodyFrame)."""
import json
from pathlib import Path
import numpy as np
from train_alphabet_v6 import body_features, aspect_of, POSE, DATA
import train_alphabet_v5 as v5

ROOT = Path(__file__).resolve().parents[2]
rows = [r for r in json.loads((DATA / 'manifest.json').read_text()) if r['train'] == 'False'][:40:4]
out = []
for r in rows:
    hand = np.load(v5.CACHE / (r['attachment_id'] + '.npz'))['frames']
    pose = np.load(POSE / (r['attachment_id'] + '.npz'))['pose']
    asp = aspect_of(r['attachment_id'])
    for i in range(0, min(len(hand), len(pose)), 9):
        out.append(dict(hand=hand[i].tolist(), pose=pose[i].tolist(), aspect=asp, body=body_features(hand[i], pose[i], asp).tolist()))
(ROOT / 'frontend/public/models/rsl/alphabet-v6-body-fixtures.json').write_text(json.dumps(out[:60]))
print('BODY_FIXTURES', len(out[:60]), sum(o['body'][-1] for o in out[:60]))
