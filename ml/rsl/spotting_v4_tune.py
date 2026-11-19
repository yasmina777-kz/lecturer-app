"""Continuous spotting for word models v3/v4 on concatenated test-signer
streams (HALF=tune picks settings, HALF=eval reports them) plus synthetic
resting hands. New knob vs v3: a window counts as "no sign" only when
p(__none__) >= NONE (v3 used plain argmax, which also swallowed many real
signs). Usage: HALF=tune python spotting_v4_tune.py model.json [more members]"""
import json, os, random, sys
from pathlib import Path
import numpy as np
from fast_forward import forward as reference_forward
from spotting_eval import load_streams, make_streams, lcs
from spotting_gate_eval import motion
from word_features import clip_features, resample
ROOT = Path(__file__).resolve().parents[2]
MODELS = [json.loads(Path(p).read_text()) for p in sys.argv[1:]]
COURSE = MODELS[0]['courseLabels']
LABELS = MODELS[0]['labels']
IDX = [LABELS.index(t) for t in COURSE]
NONE_I = LABELS.index('__none__')
GRID = json.loads(os.environ.get('GRID', '[[0.3,2,0.5],[0.3,2,0.7],[0.3,2,1.1],[0.25,2,0.7],[0.2,2,0.7],[0.4,2,0.7],[0.3,3,0.7],[0.5,1,0.7]]'))

def probs(frames, w, h):
    f = clip_features([[np.array(x) for x in fr] for fr in frames], w, h)
    if f is None or sum(1 for r in f if r[65] or r[131]) < 5: return None
    return np.mean([reference_forward(m, resample(f, 32)) for m in MODELS], 0)

def spot(s, th, votes, nth, cache, gate=.6):
    fr, w, h = s['frames'], s['w'], s['h']; out, cand, v, last = [], None, 0, None
    for t in range(6, len(fr) + 1, 6):
        best = None
        for L in (16, 24, 32):
            k = (t, L)
            if k not in cache:
                win = fr[max(0, t - L):t]; cache[k] = (probs(win, w, h), motion(win, w, h))
            p, mo = cache[k]
            if p is None or mo < gate or p[NONE_I] >= nth: continue
            q = p[IDX] / p[IDX].sum(); o = np.argsort(q)[::-1]
            r = (COURSE[o[0]], float(q[o[0]]), float(q[o[0]] - q[o[1]]))
            if best is None or r[1] > best[1]: best = r
        if not (best and best[1] >= th and best[2] >= .2): cand, v = None, 0; continue
        v = v + 1 if best[0] == cand else 1; cand = best[0]
        if v >= votes and cand != last: out.append(cand); last = cand
    return out

clips = load_streams()
streams = make_streams(clips, os.environ.get('HALF', 'tune'), 120, 2)
rng = random.Random(3); rest = []
for c in rng.sample([c for c in clips.values() if c['split'] == 'test'], 120):
    base = next((fr for fr in c['hands'] if fr), None)
    if base: rest.append(dict(frames=[[(np.array(hd) + np.random.default_rng(i).normal(0, .003, (21, 3))).tolist() for hd in base] for i in range(80)], labels=[], w=c['w'], h=c['h']))
caches = [dict() for _ in streams]; rc = [dict() for _ in rest]
for th, votes, nth in GRID:
    c = e = tot = 0
    for s, ca in zip(streams, caches):
        o = spot(s, th, votes, nth, ca); c += lcs(o, s['labels']); e += len(o); tot += len(s['labels'])
    fp = sum(len(spot(s, th, votes, nth, ca)) for s, ca in zip(rest, rc))
    print(json.dumps(dict(half=os.environ.get('HALF', 'tune'), members=len(MODELS), th=th, votes=votes, none=nth, precision=round(c / max(1, e), 3), recall=round(c / tot, 3), f1=round(2 * c / max(1, e + tot), 3), restFalseWordsPer4s=round(fp / len(rest), 3))), flush=True)
