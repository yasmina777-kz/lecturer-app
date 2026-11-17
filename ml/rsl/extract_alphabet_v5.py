"""Per-frame hand features for every Bukva clip (v5 training input).

Unlike extract_alphabet.py (16 uniformly spaced frames per clip), this keeps
every decoded frame plus its timestamp. Training can then cut windows with the
same 100 ms cadence the browser camera uses, instead of only whole-clip
resampling. MediaPipe runs in VIDEO mode like the browser letter worker.
The per-frame 66-D vector is exactly extract_alphabet.frame_features, which is
the Python twin of frontend/src/sign/temporal.ts temporalFrame.
"""
from pathlib import Path
import concurrent.futures
import json
import multiprocessing
import time

import cv2
import mediapipe as mp
import numpy as np

from extract_alphabet import frame_features

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'ml/rsl/data/alphabet'
MODEL = ROOT / 'frontend/public/models/rsl/hand_landmarker.task'
CACHE = DATA / 'features-v5'
DETECTOR = None


def init():
    global DETECTOR
    cv2.setNumThreads(1)
    opts = mp.tasks.vision.HandLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL)),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_hands=2, min_hand_detection_confidence=.5, min_tracking_confidence=.7)
    DETECTOR = mp.tasks.vision.HandLandmarker.create_from_options(opts)


def process(row):
    out = CACHE / (row['attachment_id'] + '.npz')
    if out.exists():
        return 'cached'
    path = DATA / (row['attachment_id'] + '.mp4')
    if not path.exists():
        return 'missing'
    # VIDEO mode needs monotonically increasing timestamps across the whole
    # process lifetime, so keep a per-process offset between clips.
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frames, times = [], []
    index = 0
    while True:
        ok, img = cap.read()
        if not ok:
            break
        h, w = img.shape[:2]
        factor = min(1, 640 / max(h, w))
        img = cv2.resize(img, (max(1, int(w * factor)), max(1, int(h * factor))))
        t_ms = index * 1000.0 / fps
        result = DETECTOR.detect_for_video(
            mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)),
            process.offset + int(t_ms))
        frames.append(frame_features(result))
        times.append(t_ms)
        index += 1
    cap.release()
    # Gap of 10 s between clips forces tracking to re-detect from scratch.
    process.offset += int(index * 1000.0 / fps) + 10_000
    tmp = out.with_suffix('.tmp.npz')
    np.savez_compressed(tmp, frames=np.asarray(frames, dtype=np.float32).reshape(-1, 66),
                        times=np.asarray(times, dtype=np.float32), fps=np.float32(fps))
    tmp.replace(out)
    return 'done'


process.offset = 0


if __name__ == '__main__':
    CACHE.mkdir(exist_ok=True)
    rows = json.loads((DATA / 'manifest.json').read_text())
    started = time.monotonic()
    results = {}
    with concurrent.futures.ProcessPoolExecutor(
            max_workers=8, mp_context=multiprocessing.get_context('spawn'), initializer=init) as pool:
        for i, status in enumerate(pool.map(process, rows, chunksize=4)):
            results[status] = results.get(status, 0) + 1
            if i % 200 == 0:
                print('EXTRACT', i + 1, len(rows), results, round(time.monotonic() - started), flush=True)
    print('EXTRACTION_COMPLETE', results, flush=True)
