"""Continuous spotting: v2 ensemble vs v3 ensemble (with __none__), same
eval-half test streams and synthetic resting hands as spotting_gate_eval.py."""
import json, random, sys
from pathlib import Path
import numpy as np
from seqnet import reference_forward
from spotting_eval import load_streams, make_streams, lcs
from spotting_gate_eval import motion
from word_features import clip_features, resample
ROOT = Path(__file__).resolve().parents[2]
V2 = [json.loads((ROOT / 'ml/rsl/data/slovo-word-v2/classifier.json').read_text())]
V3 = [json.loads(Path(p).read_text()) for p in sys.argv[1:]]
COURSE = [l for l in V3[0]['courseLabels']]

def classify(models, frames, w, h):
    f = clip_features([[np.array(x) for x in fr] for fr in frames], w, h)
    if f is None or sum(1 for r in f if r[65] or r[131]) < 5: return None
    p = np.mean([reference_forward(m, resample(f, 32)) for m in models], 0)
    labels = models[0]['labels']
    if labels[-1] == '__none__' and p.argmax() == len(labels) - 1: return 'none'
    idx = [labels.index(t) for t in COURSE]
    q = p[idx] / p[idx].sum(); o = np.argsort(q)[::-1]
    return COURSE[o[0]], float(q[o[0]]), float(q[o[0]] - q[o[1]])

def spot(models, s, th, cache, gate=.6, votes=2):
    fr, w, h = s['frames'], s['w'], s['h']; out, cand, v, last = [], None, 0, None
    for t in range(6, len(fr) + 1, 6):
        best = None
        for L in (16, 24, 32):
            k = (t, L)
            if k not in cache:
                win = fr[max(0, t - L):t]; cache[k] = (classify(models, win, w, h), motion(win, w, h))
            r, mo = cache[k]
            if r == 'none' or r is None or mo < gate: continue
            if best is None or r[1] > best[1]: best = r
        if not (best and best[1] >= th and best[2] >= .2): cand, v = None, 0; continue
        v = v + 1 if best[0] == cand else 1; cand = best[0]
        if v >= votes and cand != last: out.append(cand); last = cand
    return out

clips = load_streams()
streams = make_streams(clips, __import__('os').environ.get('HALF', 'tune'), 120, 2)
rng = random.Random(3); rest = []
for c in rng.sample([c for c in clips.values() if c['split'] == 'test'], 120):
    base = next((fr for fr in c['hands'] if fr), None)
    if base: rest.append(dict(frames=[[(np.array(hd) + np.random.default_rng(i).normal(0, .003, (21, 3))).tolist() for hd in base] for i in range(80)], labels=[], w=c['w'], h=c['h']))
for name, models in (('v3', V3),):
    caches = [dict() for _ in streams]; rc = [dict() for _ in rest]
    for th, votes in ((.3, 2), (.25, 2), (.2, 2), (.5, 1), (.6, 1), (.7, 1)):
        c = e = tot = 0
        for s, ca in zip(streams, caches):
            o = spot(models, s, th, ca, votes=votes); c += lcs(o, s['labels']); e += len(o); tot += len(s['labels'])
        fp = sum(len(spot(models, s, th, ca, votes=votes)) for s, ca in zip(rest, rc))
        print(json.dumps(dict(model=name, members=len(models), th=th, votes=votes, precision=round(c / max(1, e), 3), recall=round(c / tot, 3), f1=round(2 * c / max(1, e + tot), 3), restFalseWordsPer4s=round(fp / len(rest), 3))), flush=True)
