"""Body landmarks for every Slovo video, frame-aligned with slovo_mediapipe.json.

Reads the videos straight out of data/slovo-full/slovo.zip (one temp file at a
time), runs MediaPipe Pose lite (the browser's model) on every frame at 640 px,
VIDEO mode. Per frame: nose, mouth corners, shoulders, elbows, wrists as
(x, y, visibility) → data/slovo-pose/<attachment_id>.npz  [T, 9, 3]
  .venv/bin/python -I extract_slovo_pose.py
"""
from pathlib import Path
import concurrent.futures, multiprocessing, os, tempfile, time, zipfile
import cv2, mediapipe as mp, numpy as np

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'ml/rsl/data'
ZIP = DATA / 'slovo-full/slovo.zip'
OUT = DATA / 'slovo-pose'
MODEL = ROOT / 'frontend/public/models/rsl/pose_landmarker_lite.task'
POINTS = [0, 9, 10, 11, 12, 13, 14, 15, 16]
DET = ZF = TMP = None


def init():
    global DET, ZF, TMP
    cv2.setNumThreads(1)
    DET = mp.tasks.vision.PoseLandmarker.create_from_options(mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL)),
        running_mode=mp.tasks.vision.RunningMode.VIDEO, num_poses=1))
    ZF = zipfile.ZipFile(ZIP)
    TMP = tempfile.mkdtemp(prefix='slovo-pose-')


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
    frames, i = [], 0
    while True:
        ok, img = cap.read()
        if not ok:
            break
        h, w = img.shape[:2]
        f = min(1, 640 / max(h, w))
        img = cv2.resize(img, (max(1, int(w * f)), max(1, int(h * f))))
        r = DET.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)),
                                 process.offset + int(i * 1000.0 / fps))
        frames.append([[r.pose_landmarks[0][k].x, r.pose_landmarks[0][k].y, r.pose_landmarks[0][k].visibility] for k in POINTS]
                      if r.pose_landmarks else [[0, 0, 0]] * len(POINTS))
        i += 1
    cap.release()
    process.offset += int(i * 1000.0 / fps) + 10_000
    tmp = out.with_suffix('.tmp.npz')
    np.savez_compressed(tmp, pose=np.asarray(frames, np.float32).reshape(-1, len(POINTS), 3))
    tmp.replace(out)
    return 'done'


process.offset = 0

if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    names = [n for n in zipfile.ZipFile(ZIP).namelist() if n.lower().endswith('.mp4') and not Path(n).name.startswith('.')]
    print('videos', len(names), flush=True)
    t0, res = time.monotonic(), {}
    with concurrent.futures.ProcessPoolExecutor(max_workers=9, mp_context=multiprocessing.get_context('spawn'), initializer=init) as pool:
        for i, s in enumerate(pool.map(process, names, chunksize=8)):
            res[s] = res.get(s, 0) + 1
            if i % 1000 == 0:
                print('POSE', i + 1, len(names), res, round(time.monotonic() - t0), flush=True)
    print('POSE_COMPLETE', res, round(time.monotonic() - t0), flush=True)
