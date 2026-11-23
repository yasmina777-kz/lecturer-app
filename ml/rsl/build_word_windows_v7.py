"""Training windows v7 from the untrimmed Slovo videos (data/slovo-origin-lm).

Landmarks come from the browser's own models (extract_slovo_origin.py), so the
features match what the live camera produces. Each video gives:
  * the sign itself: frames [begin, end] (annotation), label = its text;
  * real "no sign" windows: hands rising, resting or dropping outside the sign
    (window overlaps the sign by < 25 %), label = __none__;
  * edge windows: a window that catches only the start or end of the sign
    (overlap 25–55 %) — also __none__, so the spotter waits for the whole sign.
Windows are 24–48 frames (≈ the browser's 0.8–1.6 s spotting windows at 30 fps)
and are featurized one by one, exactly like the browser does per window.
  .venv/bin/python -I build_word_windows_v7.py → data/slovo-word-windows-v7.npz
"""
import os as _os, sys as _sys; _sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
import csv, os, time
from pathlib import Path
import numpy as np
from word_features import clip_features

DATA = Path(__file__).resolve().parents[2] / 'ml/rsl/data'
LM = Path(os.environ.get('LM', DATA / 'slovo-origin-lm'))
ANN = Path(os.environ.get('ANN', DATA / 'slovo-origin/annotations.csv'))
NEG_PER_VIDEO = 3
rng = np.random.default_rng(7)


def hands_list(h):
    return [[f[k] for k in range(2) if not np.isnan(f[k, 0, 0])] for f in h]


def feats(h, pose, a, b, w, hgt):
    return clip_features(hands_list(h[a:b]), w, hgt, pose[a:b])


rows = list(csv.DictReader(ANN.read_text().splitlines(), delimiter='\t' if '\t' in ANN.read_text()[:500] else ','))
chunks, offsets, labels, kinds, ids = [], [0], [], [], []
t0 = time.monotonic()
for n, r in enumerate(rows, 1):
    aid = r['attachment_id']
    f = LM / (aid + '.npz')
    if r.get('text') in (None, '', 'no_event') or not f.exists():
        continue
    d = np.load(f)
    h, pose = d['hands'], d['pose']
    T = len(h)
    w, hgt = float(r['width']), float(r['height'])
    try:
        b0, b1 = int(float(r['begin'])), int(float(r['end']))
    except (KeyError, ValueError):
        continue
    b0, b1 = max(0, b0), min(T, b1 + 1)
    if b1 - b0 < 4:
        continue
    out = []
    x = feats(h, pose, b0, b1, w, hgt)
    if x is not None and len(x) >= 4:
        out.append((x, r['text'], 'sign'))
    sign_len = b1 - b0
    made, tries = 0, 0
    while made < NEG_PER_VIDEO and tries < 30:
        tries += 1
        L = int(rng.integers(24, 49))
        if T <= L:
            break
        a = int(rng.integers(0, T - L))
        ov = max(0, min(a + L, b1) - max(a, b0)) / sign_len
        kind = 'rest' if ov < .25 else 'edge' if ov <= .55 else None
        if kind is None:
            continue
        x = feats(h, pose, a, a + L, w, hgt)
        if x is None or len(x) < 4 or sum(1 for v in x if v[65] or v[131]) < 5:
            continue  # no hands in view: the browser never classifies those
        out.append((x, '__none__', kind))
        made += 1
    for x, lab, kind in out:
        chunks.append(x.astype(np.float16)); offsets.append(offsets[-1] + len(x)); labels.append(lab); kinds.append(kind); ids.append(aid)
    if n % 2000 == 0:
        print('WINDOWS', n, len(rows), len(ids), round(time.monotonic() - t0), flush=True)
np.savez(Path(os.environ.get('OUT', DATA / 'slovo-word-windows-v7.npz')), x=np.concatenate(chunks), offsets=np.array(offsets),
         labels=np.array(labels), kinds=np.array(kinds), ids=np.array(ids))
print('WINDOWS_V7', len(ids), {k: kinds.count(k) for k in set(kinds)}, round(time.monotonic() - t0), flush=True)
