"""Body landmarks for every Bukva clip, frame-aligned with features-v5.

The v5 letter model sees one hand only. This adds where that hand is on the
body: MediaPipe Pose (the same lite model the browser letter worker loads),
VIDEO mode, the same 640 px frames and timestamps as extract_alphabet_v5.py.
Per frame: nose, mouth corners, shoulders, elbows, wrists as (x, y, visibility)
in image coordinates → data/alphabet/pose-v6/<id>.npz  [T, 9, 3]
  .venv/bin/python extract_alphabet_pose.py
"""
from pathlib import Path
import concurrent.futures, json, multiprocessing, time
import cv2, mediapipe as mp, numpy as np

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'ml/rsl/data/alphabet'
MODEL = ROOT / 'frontend/public/models/rsl/pose_landmarker_lite.task'
CACHE = DATA / 'pose-v6'
POINTS = [0, 9, 10, 11, 12, 13, 14, 15, 16]
DETECTOR = None


def init():
    global DETECTOR
    cv2.setNumThreads(1)
    opts = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL)),
        running_mode=mp.tasks.vision.RunningMode.VIDEO, num_poses=1)
    DETECTOR = mp.tasks.vision.PoseLandmarker.create_from_options(opts)


def process(row):
    out = CACHE / (row['attachment_id'] + '.npz')
    if out.exists():
        return 'cached'
    path = DATA / (row['attachment_id'] + '.mp4')
    if not path.exists():
        return 'missing'
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frames, index = [], 0
    while True:
        ok, img = cap.read()
        if not ok:
            break
        h, w = img.shape[:2]
        f = min(1, 640 / max(h, w))
        img = cv2.resize(img, (max(1, int(w * f)), max(1, int(h * f))))
        r = DETECTOR.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)),
                                      process.offset + int(index * 1000.0 / fps))
        if r.pose_landmarks:
            p = r.pose_landmarks[0]
            frames.append([[p[i].x, p[i].y, p[i].visibility] for i in POINTS])
        else:
            frames.append([[0, 0, 0]] * len(POINTS))
        index += 1
    cap.release()
    process.offset += int(index * 1000.0 / fps) + 10_000
    tmp = out.with_suffix('.tmp.npz')
    np.savez_compressed(tmp, pose=np.asarray(frames, dtype=np.float32).reshape(-1, len(POINTS), 3))
    tmp.replace(out)
    return 'done'


process.offset = 0

if __name__ == '__main__':
    CACHE.mkdir(exist_ok=True)
    rows = json.loads((DATA / 'manifest.json').read_text())
    started, results = time.monotonic(), {}
    with concurrent.futures.ProcessPoolExecutor(max_workers=8, mp_context=multiprocessing.get_context('spawn'), initializer=init) as pool:
        for i, status in enumerate(pool.map(process, rows, chunksize=4)):
            results[status] = results.get(status, 0) + 1
            if i % 400 == 0:
                print('POSE', i + 1, len(rows), results, round(time.monotonic() - started), flush=True)
    print('POSE_COMPLETE', results, round(time.monotonic() - started), flush=True)
