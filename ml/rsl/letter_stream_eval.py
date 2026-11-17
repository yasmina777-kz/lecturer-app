"""Letter confirmation policy on held-out Bukva clips replayed at 100 ms cadence.
Compares the current 2-window consensus with faster single-window rules."""
import json, sys
from pathlib import Path
import numpy as np
from seqnet import reference_forward
from train_alphabet_v5 import normalize_window, stream_window, LABELS, NO_EVENT, CACHE, DATA
ROOT = Path(__file__).resolve().parents[2]
model = json.loads((ROOT / 'frontend/public/models/rsl/alphabet-v5-classifier.json').read_text())
rows = [r for r in json.loads((DATA / 'manifest.json').read_text()) if r['train'] == 'False']
clips = []
for r in rows:
    d = np.load(CACHE / (r['attachment_id'] + '.npz'))
    clips.append((d['frames'], d['times'], LABELS.index(r['text'])))
def probs(frames, times, stride_ms):
    dur = float(times[-1]); starts = np.arange(0, max(0., dur - 1500) + 1, stride_ms) if dur > 1500 else [0.]
    out = []
    for s in starts:
        w = normalize_window(stream_window(frames, times, None, 100., s))
        out.append((reference_forward(model, w), (w[:, 65] > 0).sum()))
    return out
policies = {'current: 2 windows >=0.6': (.6, 2), '1 window >=0.9': (.9, 1), '1 window >=0.8': (.8, 1), '2 windows >=0.5': (.5, 2)}
res = {k: [0, 0, 0] for k in policies}
for frames, times, y in clips:
    if y == NO_EVENT: continue
    seq = probs(frames, times, 200)
    for name, (th, need) in policies.items():
        cand, votes, emitted = None, 0, None
        for p, vis in seq:
            o = np.argsort(p)[::-1]
            ok = p[o[0]] >= th and p[o[0]] - p[o[1]] >= .2 and o[0] != NO_EVENT and vis >= 8
            if not ok: cand, votes = None, 0; continue
            votes = votes + 1 if o[0] == cand else 1; cand = o[0]
            if votes >= need: emitted = o[0]; break
        res[name][0] += emitted == y; res[name][1] += emitted is not None and emitted != y; res[name][2] += 1
for k, (c, w, n) in res.items():
    print(f'{k:28s} correct {c}/{n} ({c/n:.1%})  wrong {w} ({w/max(1,c+w):.1%} of emitted)')
