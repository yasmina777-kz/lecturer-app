"""Hands + body for every *untrimmed* Slovo video (slovo_full360.zip).

The untrimmed originals keep the moments before and after each sign (hands
rising, resting, dropping). Those real transitions are what the continuous
translator confuses with signs, so they become "no sign" training data.

Runs the browser's own models (hand_landmarker.task, 2 hands; pose lite) on
every frame, VIDEO mode, and writes data/slovo-origin-lm/<attachment_id>.npz:
  hands [T, 2, 21, 3]  (x, y, z; NaN where no hand; larger hand first)
  pose  [T, 9, 3]      (nose, mouth L/R, shoulders, elbows, wrists: x, y, visibility)
  fps   scalar
  .venv/bin/python -I extract_slovo_origin.py           (ZIP=... to override; LIMIT=n for a trial)
"""
from pathlib import Path
import concurrent.futures, multiprocessing, os, tempfile, time, zipfile
import cv2, mediapipe as mp, numpy as np

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'ml/rsl/data'
ZIP = Path(os.environ.get('ZIP', DATA / 'slovo-origin/slovo_full360.zip'))
OUT = Path(os.environ.get('OUT', DATA / 'slovo-origin-lm'))
HAND_MODEL = ROOT / 'frontend/public/models/rsl/hand_landmarker.task'
POSE_MODEL = ROOT / 'frontend/public/models/rsl/pose_landmarker_lite.task'
POINTS = [0, 9, 10, 11, 12, 13, 14, 15, 16]
HANDS = POSE = ZF = TMP = None


def init():
    global HANDS, POSE, ZF, TMP
    cv2.setNumThreads(1)
    vision = mp.tasks.vision
    HANDS = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(HAND_MODEL)),
        running_mode=vision.RunningMode.VIDEO, num_hands=2))
    POSE = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(POSE_MODEL)),
        running_mode=vision.RunningMode.VIDEO, num_poses=1))
    ZF = zipfile.ZipFile(ZIP)
    TMP = tempfile.mkdtemp(prefix='slovo-origin-')


def process(name):
    aid = Path(name).stem
    out = OUT / (aid + '.npz')
    if out.exists():
        return 'cached'
    path = os.path.join(TMP, 'clip.mp4')
    with ZF.open(name) as src, open(path, 'wb') as dst:
        dst.write(src.read())
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    hands, poses, i = [], [], 0
    while True:
        ok, img = cap.read()
        if not ok:
            break
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        ts = process.offset + int(i * 1000.0 / fps)
        h = np.full((2, 21, 3), np.nan, np.float32)
        r = HANDS.detect_for_video(image, ts)
        found = [np.array([[p.x, p.y, p.z] for p in lm], np.float32) for lm in r.hand_landmarks]
        found.sort(key=lambda a: -(np.ptp(a[:, 0]) * np.ptp(a[:, 1])))
        for k, a in enumerate(found[:2]):
            h[k] = a
        hands.append(h)
        p = POSE.detect_for_video(image, ts)
        poses.append([[p.pose_landmarks[0][k].x, p.pose_landmarks[0][k].y, p.pose_landmarks[0][k].visibility] for k in POINTS]
                     if p.pose_landmarks else [[0, 0, 0]] * len(POINTS))
        i += 1
    cap.release()
    process.offset += int(i * 1000.0 / fps) + 10_000
    tmp = out.with_suffix('.tmp.npz')
    np.savez_compressed(tmp, hands=np.asarray(hands, np.float32).reshape(-1, 2, 21, 3),
                        pose=np.asarray(poses, np.float32).reshape(-1, len(POINTS), 3), fps=np.float32(fps))
    tmp.replace(out)
    return 'done'


process.offset = 0

if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    names = [n for n in zipfile.ZipFile(ZIP).namelist() if n.lower().endswith('.mp4') and not Path(n).name.startswith('.')]
    # Random order: a partial run is a fair sample (quick trial before the full set).
    import random
    random.Random(7).shuffle(names)
    if os.environ.get('LIMIT'):
        names = names[:int(os.environ['LIMIT'])]
    print('videos', len(names), flush=True)
    t0, res = time.monotonic(), {}
    with concurrent.futures.ProcessPoolExecutor(max_workers=int(os.environ.get('WORKERS', 8)), mp_context=multiprocessing.get_context('spawn'), initializer=init) as pool:
        for i, s in enumerate(pool.map(process, names, chunksize=8)):
            res[s] = res.get(s, 0) + 1
            if i % 500 == 0:
                print('ORIGIN', i + 1, len(names), res, round(time.monotonic() - t0), flush=True)
    print('ORIGIN_COMPLETE', res, round(time.monotonic() - t0), flush=True)
