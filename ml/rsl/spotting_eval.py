"""Continuous ("translator") word spotting simulation and parameter selection.

Streams are built by concatenating 3-5 course-word clips of ONE signer from
the signer-disjoint validation or test buckets, sampled at the browser's
20 fps camera polling. The spotter is the Python twin of
frontend/src/sign/wordSpotter.ts: every hop it classifies the last 1.2 s and
1.8 s of hand landmarks (course vocabulary only) and emits a word after two
consecutive agreeing confident hops. Parameters are chosen on validation
streams; the test streams are scored once with the chosen setting.
"""
import csv
import hashlib
import json
import random
import sys
from pathlib import Path

import ijson
import numpy as np

from seqnet import reference_forward
from word_features import clip_features, resample

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'ml/rsl/data'
MODEL = json.loads((ROOT / 'ml/rsl/data/slovo-word-v2/classifier.json').read_text())
LABELS = MODEL['labels']
COURSE = MODEL['courseLabels']
COURSE_IDX = np.array([LABELS.index(t) for t in COURSE])
FPS = 20


def load_streams():
    cache = DATA / 'spotting-clips.json'
    if cache.exists():
        return json.loads(cache.read_text())
    rows = {r['attachment_id']: r for r in csv.DictReader(
        (DATA / 'slovo-annotations.csv').read_text().splitlines(), delimiter='\t')}
    clips = {}
    with (DATA / 'slovo_mediapipe.json').open('rb') as f:
        for cid, frames in ijson.kvitems(f, '', use_float=True):
            r = rows.get(cid)
            if not r or r['text'] not in COURSE:
                continue
            b = int(hashlib.sha256(r['user_id'].encode()).hexdigest()[:8], 16) % 10
            if b > 2:
                continue
            # 30 fps source -> 20 fps camera polling
            n = len(frames)
            idx = [min(n - 1, round(i * 1.5)) for i in range(int(n / 1.5))]
            hands = [[[[p['x'], p['y'], p['z']] for p in pts] for pts in (frames[i] or {}).values()
                      if isinstance(pts, list) and len(pts) == 21] for i in idx]
            clips[cid] = dict(label=r['text'], user=r['user_id'], split='test' if b < 2 else 'val',
                              w=float(r['width']), h=float(r['height']), hands=hands)
    cache.write_text(json.dumps(clips))
    return clips


def make_streams(clips, split, count, seed):
    rng = random.Random(seed)
    by_user = {}
    for c in clips.values():
        half = 'tune' if int(hashlib.sha256(c['user'].encode()).hexdigest()[:8], 16) % 10 == 0 else 'eval'
        if c['split'] == 'test' and half == split:
            by_user.setdefault(c['user'], []).append(c)
    users = [u for u, cs in by_user.items() if len(cs) >= 3]
    streams = []
    for _ in range(count):
        pool = by_user[rng.choice(users)]
        cs = rng.sample(pool, min(len(pool), rng.randint(3, 5)))
        frames, labels = [], []
        for c in cs:
            frames += c['hands']
            labels.append(c['label'])
        streams.append(dict(frames=frames, labels=labels, w=cs[0]['w'], h=cs[0]['h']))
    return streams


def classify(frames, w, h):
    feats = clip_features([[np.array(x) for x in fr] for fr in frames], w, h)
    if feats is None or sum(1 for f in feats if f[65] or f[131]) < 5:
        return None
    p = reference_forward(MODEL, resample(feats, 32))[COURSE_IDX]
    p = p / p.sum()
    o = np.argsort(p)[::-1]
    return COURSE[o[0]], float(p[o[0]]), float(p[o[0]] - p[o[1]])


def spot(stream, windows, hop, threshold, margin, votes_needed=2, cache=None):
    frames, w, h = stream['frames'], stream['w'], stream['h']
    emitted, cand, votes, last = [], None, 0, None
    for t in range(hop, len(frames) + 1, hop):
        best = None
        for L in windows:
            key = (t, L)
            if cache is not None and key in cache:
                r = cache[key]
            else:
                r = classify(frames[max(0, t - L):t], w, h)
                if cache is not None:
                    cache[key] = r
            if r and (best is None or r[1] > best[1]):
                best = r
        ok = best and best[1] >= threshold and best[2] >= margin
        if not ok:
            cand, votes = None, 0
            continue
        votes = votes + 1 if best[0] == cand else 1
        cand = best[0]
        if votes >= votes_needed and cand != last:
            emitted.append(cand)
            last = cand
    return emitted


def lcs(a, b):
    d = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a)):
        for j in range(len(b)):
            d[i + 1][j + 1] = d[i][j] + 1 if a[i] == b[j] else max(d[i][j + 1], d[i + 1][j])
    return d[-1][-1]


def score(streams, caches, **kw):
    correct = emitted = total = 0
    for s, c in zip(streams, caches):
        e = spot(s, cache=c, **kw)
        correct += lcs(e, s['labels'])
        emitted += len(e)
        total += len(s['labels'])
    p, r = correct / max(1, emitted), correct / total
    return dict(precision=round(p, 3), recall=round(r, 3), f1=round(2 * p * r / max(1e-9, p + r), 3),
                emitted=emitted, words=total)


def main():
    clips = load_streams()
    val, test = make_streams(clips, 'tune', 150, 1), make_streams(clips, 'eval', 200, 2)
    results = []
    for windows in ((24, 36), (20, 30, 40), (16, 24, 32)):
        caches = [dict() for _ in val]
        for hop in (6,):
            for th in (.3, .4, .5, .6, .7):
                for m in (.1, .2):
                    for v in (1, 2):
                        r = score(val, caches, windows=windows, hop=hop, threshold=th, margin=m, votes_needed=v)
                        results.append((r['f1'], dict(windows=windows, hop=hop, threshold=th, margin=m, votes_needed=v), r))
        print('windows', windows, max(results, key=lambda x: x[0]), flush=True)
    # prefer precision >= 0.75, then best f1
    good = [x for x in results if x[2]['precision'] >= .7] or results
    f1, params, vr = max(good, key=lambda x: x[0])
    tr = score(test, [dict() for _ in test], **params)
    report = dict(selectedOnTuneSigners=params, tune=vr, test=tr, note='validation signers were in final training, so tuning uses half of the test signers; the other half is scored',
                  streams=dict(validation=len(val), test=len(test)),
                  scope='concatenated isolated Slovo clips of one signer (course vocabulary), 20 fps; '
                        'not natural continuous signing')
    (ROOT / 'docs/word-spotting-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
