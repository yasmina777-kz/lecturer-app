"""Kazakh everyday phrases («Оян, Qazaqstan», Седьмой канал) → word features.

Each phrase segment (PHRASES in build_teacher_lessons.py, written to
frontend/public/research/ksl/teacher-lessons.json) shows the presenter signing the
phrase, then 3–5 people on the street signing it. Every camera shot of the
segment (split at scene cuts) is one signer; inside a shot the phrase is cut into
sign attempts exactly like the browser camera does (segment(), a port of
WordSegmenter in frontend/src/sign/wordRecognizer.ts), so training clips look like
what the dialogue camera check sees. Videos: ml/rsl/data/ksl-words/sausaq/<id>.mp4 (local, git-ignored).
  ml/rsl/.venv/bin/python -I ml/ksl/extract_phrases.py → ml/rsl/data/ksl-words/phrases.npz
"""
from __future__ import annotations

import concurrent.futures
import json
import multiprocessing
import sys
import time
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract_words as E  # noqa: E402

ROOT = E.ROOT
VIDEOS = ROOT / 'ml/rsl/data/ksl-words/sausaq'
OUT = ROOT / 'ml/rsl/data/ksl-words/phrases.npz'


def cuts(path: Path) -> list[tuple[float, float]]:
    """Scene changes as (start, end) times: hard cuts and the ~0.5 s wipes the
    programme uses between people (runs of frames that differ a lot from the previous one)."""
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(5) or 25.
    prev, d = None, []
    while True:
        ok, im = cap.read()
        if not ok:
            break
        s = cv2.resize(im, (32, 18)).astype(np.float32)
        d.append(0. if prev is None else float(np.abs(s - prev).mean()))
        prev = s
    cap.release()
    out = []
    for k, x in enumerate(d):
        if x > 25:
            t = k / fps
            if out and t - out[-1][1] < .2:
                out[-1] = (out[-1][0], t)
            else:
                out.append((t - 1 / fps, t))
    return out


def jobs():
    data = json.loads((ROOT / 'frontend/public/research/ksl/teacher-lessons.json').read_text())
    cache = {}
    for p in data['phrases']['items']:
        path = VIDEOS / f"{p['youtube']}.mp4"
        if not path.exists():
            print('missing video', path)
            continue
        if p['youtube'] not in cache:
            cache[p['youtube']] = cuts(path)
        inner = [c for c in cache[p['youtube']] if p['start'] < c[1] and c[0] < p['end']]
        starts = [p['start']] + [c[1] for c in inner]
        ends = [c[0] for c in inner] + [p['end']]
        for k, (a, b) in enumerate(zip(starts, ends)):
            if b - a >= .8:
                yield dict(path=str(path), a=a + .08, b=b - .08, label=p['kk'], shot=k,
                           signer=f"{p['youtube']}-{p['kk']}-{k}", source='phrase', kind='shot', video=p['youtube'])


def raw(job):
    """Hands + pose per frame (~12.5 fps, 640 px), like extract_words._run, without features."""
    path, a, b = job['path'], job['a'], job['b']
    cap = cv2.VideoCapture(path)
    fps = cap.get(5) or 25.
    cap.set(cv2.CAP_PROP_POS_MSEC, a * 1000)
    hands, poses, times, i, size = [], [], [], 0, None
    while True:
        ok, img = cap.read()
        if not ok or a + i / fps > b:
            break
        i += 1
        if (i - 1) % 2:
            continue
        h, w = img.shape[:2]
        f = min(1, 640 / max(h, w))
        img = cv2.resize(img, (int(w * f), int(h * f)))
        size = img.shape[1], img.shape[0]
        im = E.mp.Image(image_format=E.mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        t = E.OFF[0] + int((i - 1) * 1000 / fps)
        r = E.H.detect_for_video(im, t)
        hands.append([np.array([[q.x, q.y, q.z] for q in hl]) for hl in r.hand_landmarks])
        r = E.P.detect_for_video(im, t)
        poses.append([[r.pose_landmarks[0][k].x, r.pose_landmarks[0][k].y, r.pose_landmarks[0][k].visibility] for k in E.POINTS]
                     if r.pose_landmarks else [[0, 0, 0]] * 9)
        times.append((i - 1) * 1000 / fps)
    cap.release()
    E.OFF[0] += int(i * 1000 / fps) + 10_000
    return job, hands, poses, times, size


def segment(hands, times, pause=900, gone=500, longest=5000):
    """Python port of WordSegmenter.push: returns (start, end) frame ranges of sign attempts."""
    out, start, n, prev, last_seen, last_motion, t0, last_idx, moving = [], None, 0, [], 0, 0, 0, 0, 0
    for k, (hs, now) in enumerate(zip(hands, times)):
        vis = [h for h in hs if len(h) == 21]
        if vis:
            wr = [h[0] for h in vis]
            motion = max(min(np.hypot(*(w[:2] - p[:2])) for p in prev) for w in wr) if prev else 0.
            prev, last_seen = wr, now
            if start is None:
                start, n, t0, last_motion, last_idx, moving = k, 0, now, now, 0, 0
            n += 1
            if motion > .012:
                last_motion, last_idx, moving = now, n - 1, moving + 1
        elif start is not None:
            n += 1
        if start is None:
            continue
        if now - t0 >= longest or (not vis and now - last_seen >= gone) or (now - t0 >= 800 and now - last_motion >= pause):
            if moving >= 2:
                out.append((start, start + min(n, last_idx + 3)))
            start, prev = None, []
    if start is not None and moving >= 2:
        out.append((start, start + min(n, last_idx + 3)))
    return out


if __name__ == '__main__':
    todo = list(jobs())
    print('shots', len(todo), flush=True)
    X, meta, t0 = [], [], time.monotonic()
    with concurrent.futures.ProcessPoolExecutor(8, mp_context=multiprocessing.get_context('spawn'), initializer=E.init) as pool:
        for job, hands, poses, times, size in pool.map(raw, todo, chunksize=1):
            if not size:
                continue
            for a, b in segment(hands, times):
                if b - a < 6:  # < 0.5 s: a twitch, not a phrase
                    continue
                x = E.clip_features(hands[a:b], float(size[0]), float(size[1]), np.asarray(poses[a:b], np.float32))
                if x is None or len(x) < 4:
                    continue
                X.append(x.astype(np.float16))
                meta.append({**{k: job[k] for k in ('label', 'shot', 'signer', 'source', 'kind', 'video')},
                             'a': round(job['a'] + times[a] / 1000, 2), 'b': round(job['a'] + times[b - 1] / 1000, 2)})
    off = np.cumsum([0] + [len(x) for x in X])
    np.savez_compressed(OUT, x=np.concatenate(X), offsets=off, meta=json.dumps(meta, ensure_ascii=False))
    from collections import Counter
    print('PHRASES', len(X), 'clips from', len({m['signer'] for m in meta}), 'shots',
          dict(Counter(m['label'] for m in meta)), round(time.monotonic() - t0), flush=True)
