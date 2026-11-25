"""Word clips for Kazakh sign recognition → v5 word features (ml/rsl/word_features.py).

Sources (videos stay local, git-ignored; only features are used):
* SURDO.KZ (YouTube surdoKazakhstan): every dictionary word, normal + slow clip,
  ml/rsl/data/surdo-yt/<id>.mp4, labels from frontend/public/research/ksl/surdo-catalog.json.
* «Саусақтар сөйлейді» topic lessons (two other Kazakh teachers):
  ml/rsl/data/ksl-words/sausaq/<id>.mp4. Each word is shown with a white word card
  (wide shot), then again in close-up. Card runs: ml/ksl/sausaq-card-runs.json,
  labels: ml/ksl/sausaq-words.tsv. Both shots of a word become clips.
MediaPipe Hands (image landmarks, 2 hands) + Pose lite at 640 px, VIDEO mode.
  ml/rsl/.venv/bin/python -I ml/ksl/extract_words.py → ml/rsl/data/ksl-words/features.npz
"""
from __future__ import annotations
import concurrent.futures, json, multiprocessing, sys, time
from pathlib import Path
import cv2, mediapipe as mp, numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ml/rsl'))
from word_features import clip_features  # noqa: E402

D = ROOT / 'ml/rsl/data'
HAND = ROOT / 'frontend/public/models/rsl/hand_landmarker.task'
POSE = ROOT / 'frontend/public/models/rsl/pose_landmarker_lite.task'
POINTS = [0, 9, 10, 11, 12, 13, 14, 15, 16]
H = P = None
OFF = [0]


def init():
    global H, P
    cv2.setNumThreads(1)
    V = mp.tasks.vision
    H = V.HandLandmarker.create_from_options(V.HandLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(HAND)), running_mode=V.RunningMode.VIDEO, num_hands=2))
    P = V.PoseLandmarker.create_from_options(V.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(POSE)), running_mode=V.RunningMode.VIDEO, num_poses=1))


CACHE = D / 'ksl-words/cache'


def key(job):
    return f"{job['video']}-{job.get('a', 0.):.1f}"


def run(job):
    c = CACHE / (key(job) + '.npy')
    if c.exists():
        x = np.load(c)
        return job, (x if len(x) else None)
    job, x = _run(job)
    np.save(c, np.zeros((0, 147), np.float16) if x is None else x)
    return job, x


def _run(job):
    path, a, b = job['path'], job.get('a', 0.), job.get('b', 1e9)
    cap = cv2.VideoCapture(path)
    fps = cap.get(5) or 25.
    if a > 0:
        cap.set(cv2.CAP_PROP_POS_MSEC, a * 1000)
    hands, poses, i, size = [], [], 0, None
    while True:
        ok, img = cap.read()
        if not ok or a + i / fps > b:
            break
        i += 1
        step = 4 if job.get('kind') == 'slow' else 2  # ~12 fps is plenty (browser: ~10 fps); slow clips play ~2.5× slower
        if (i - 1) % step:
            continue
        h, w = img.shape[:2]
        f = min(1, 640 / max(h, w))
        img = cv2.resize(img, (int(w * f), int(h * f)))
        size = img.shape[1], img.shape[0]
        im = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        t = OFF[0] + int((i - 1) * 1000 / fps)
        r = H.detect_for_video(im, t)
        hands.append([np.array([[q.x, q.y, q.z] for q in hl]) for hl in r.hand_landmarks])
        r = P.detect_for_video(im, t)
        poses.append([[r.pose_landmarks[0][k].x, r.pose_landmarks[0][k].y, r.pose_landmarks[0][k].visibility] for k in POINTS]
                     if r.pose_landmarks else [[0, 0, 0]] * 9)
    cap.release()
    OFF[0] += int(i * 1000 / fps) + 10_000
    if not size:
        return job, None
    x = clip_features(hands, float(size[0]), float(size[1]), np.asarray(poses, np.float32))
    return job, (None if x is None or len(x) < 4 else x.astype(np.float16))


def jobs():
    cat = json.loads((ROOT / 'frontend/public/research/ksl/surdo-catalog.json').read_text())
    for e in cat['entries']:
        for kind in ('youtube', 'slow'):
            v = e.get(kind)
            f = D / 'surdo-yt' / f'{v}.mp4'
            if v and f.exists():
                yield dict(path=str(f), label=e['label'], signer='surdo', source='surdo', kind=kind, video=v)
    runs = json.loads((ROOT / 'ml/ksl/sausaq-card-runs.json').read_text())
    for line in (ROOT / 'ml/ksl/sausaq-words.tsv').read_text().splitlines():
        if line.startswith('#') or not line.strip():
            continue
        vid, k, label, signer = line.split('\t')
        if label == '-':
            continue
        r = runs[vid]; fps = r['fps']; rr = r['runs']; k = int(k)
        a, b = rr[k][0] / fps, rr[k][1] / fps
        nxt = rr[k + 1][0] / fps if k + 1 < len(rr) else r['n'] / fps
        f = str(D / 'ksl-words/sausaq' / f'{vid}.mp4')
        yield dict(path=f, a=a, b=b, label=label, signer='sausaq-' + signer, source='sausaq', kind='card', video=vid)
        if nxt - b > .8:
            yield dict(path=f, a=b, b=nxt, label=label, signer='sausaq-' + signer, source='sausaq', kind='closeup', video=vid)


if __name__ == '__main__':
    CACHE.mkdir(exist_ok=True)
    todo = list(jobs())
    print('clips', len(todo), flush=True)
    X, meta, t0 = [], [], time.monotonic()
    with concurrent.futures.ProcessPoolExecutor(8, mp_context=multiprocessing.get_context('spawn'), initializer=init) as pool:
        for n, (job, x) in enumerate(pool.map(run, todo, chunksize=4)):
            if x is not None:
                X.append(x); meta.append({k: job[k] for k in ('label', 'signer', 'source', 'kind', 'video')})
            if n % 100 == 0:
                print('DONE', n, len(X), round(time.monotonic() - t0), flush=True)
    off = np.cumsum([0] + [len(x) for x in X])
    np.savez_compressed(D / 'ksl-words/features.npz', x=np.concatenate(X), offsets=off, meta=json.dumps(meta, ensure_ascii=False))
    print('FEATURES', len(X), 'clips', round(time.monotonic() - t0), flush=True)
