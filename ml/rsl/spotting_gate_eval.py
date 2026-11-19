"""Motion gate for continuous spotting: false words on resting hands vs recall.
Eval half of held-out test signers only (same split as spotting_eval.py)."""
import json, random
import numpy as np
from spotting_eval import load_streams, make_streams, classify, lcs, COURSE
from word_features import clip_features

def motion(frames, w, h):
    """Smoothed wrist extent (palm lengths), max over both hands."""
    f = clip_features([[np.array(x) for x in fr] for fr in frames], w, h)
    if f is None: return 0.
    best = 0.
    for b in (0, 66):
        pts = f[f[:, b + 65] > 0][:, b + 63:b + 65]
        if len(pts) < 3: continue
        k = np.ones(3) / 3
        sm = np.stack([np.convolve(pts[:, i], k, mode='valid') for i in range(2)], 1)
        best = max(best, float((sm.max(0) - sm.min(0)).max()))
    return best

def spot(s, windows, th, m, votes, gate, cache):
    fr, w, h = s['frames'], s['w'], s['h']; out, cand, v, last = [], None, 0, None
    for t in range(6, len(fr) + 1, 6):
        best = None
        for L in windows:
            win = fr[max(0, t - L):t]
            k = (t, L)
            if k not in cache: cache[k] = (classify(win, w, h), motion(win, w, h))
            r, mo = cache[k]
            if r and mo >= gate and (best is None or r[1] > best[1]): best = r
        if not (best and best[1] >= th and best[2] >= m): cand, v = None, 0; continue
        v = v + 1 if best[0] == cand else 1; cand = best[0]
        if v >= votes and cand != last: out.append(cand); last = cand
    return out

def main():
    clips = load_streams()
    streams = make_streams(clips, 'eval', 120, 2)
    rng = random.Random(3)
    # Resting hands: one frame from the start of a clip held 4 s with landmark jitter.
    rest = []
    for c in rng.sample([c for c in clips.values() if c['split'] == 'test'], 120):
        base = next((fr for fr in c['hands'] if fr), None)
        if not base: continue
        frames = [[(np.array(hd) + np.random.default_rng(i).normal(0, .003, (21, 3))).tolist() for hd in base] for i in range(80)]
        rest.append(dict(frames=frames, labels=[], w=c['w'], h=c['h']))
    caches = [dict() for _ in streams]; rcaches = [dict() for _ in rest]
    for gate in (0, .3, .6, 1.0):
        for th, votes in ((.3, 2), (.4, 2), (.5, 2)):
            c = e = tot = 0
            for s, ca in zip(streams, caches):
                o = spot(s, (16, 24, 32), th, .2, votes, gate, ca); c += lcs(o, s['labels']); e += len(o); tot += len(s['labels'])
            fp = sum(len(spot(s, (16, 24, 32), th, .2, votes, gate, ca)) for s, ca in zip(rest, rcaches))
            print(json.dumps(dict(gate=gate, th=th, votes=votes, precision=round(c / max(1, e), 3), recall=round(c / tot, 3), restFalseWordsPer4s=round(fp / len(rest), 3))), flush=True)


if __name__ == "__main__":
    main()
