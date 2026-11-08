"""Extract two hands and shoulders/elbows/wrists using the browser's task files."""
import argparse
import concurrent.futures
import hashlib
import json
import time
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'ml/krsl/data/expressions'
MODELS = ROOT / 'frontend/public/models/rsl'
POSE = [11, 12, 13, 14, 15, 16]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def extract(sample):
    video = Path(sample.get('video', str(DATA / 'videos' / (sample['id'] + '.mp4'))))
    output = DATA / 'features' / (sample['id'] + '.npz')
    signature = hashlib.sha256(json.dumps(dict(video=digest(video),
        code=digest(Path(__file__)), hand=digest(MODELS / 'hand_landmarker.task'),
        pose=digest(MODELS / 'pose_landmarker_lite.task'), mp=mp.__version__), sort_keys=True).encode()).hexdigest()
    if output.exists():
        with np.load(output, allow_pickle=False) as f:
            if str(f['fingerprint']) == signature:
                return sample['id'], len(f['rows'])
    options = mp.tasks.BaseOptions
    vision = mp.tasks.vision
    hand_options = vision.HandLandmarkerOptions(
        base_options=options(model_asset_path=str(MODELS / 'hand_landmarker.task')),
        running_mode=vision.RunningMode.VIDEO, num_hands=2,
        min_hand_detection_confidence=.5, min_hand_presence_confidence=.5,
        min_tracking_confidence=.5)
    pose_options = vision.PoseLandmarkerOptions(
        base_options=options(model_asset_path=str(MODELS / 'pose_landmarker_lite.task')),
        running_mode=vision.RunningMode.VIDEO)
    cap = cv2.VideoCapture(str(video))
    rows, timestamps = [], []
    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        if not cap.isOpened() or not np.isfinite(fps) or fps <= 0:
            raise ValueError(f'Invalid video {video}')
        step = max(1, round(fps / 10))
        n = 0
        with vision.HandLandmarker.create_from_options(hand_options) as hands, vision.PoseLandmarker.create_from_options(pose_options) as pose:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                if n % step == 0:
                    h, w = frame.shape[:2]
                    scale = min(1., 640 / max(h, w))
                    frame = cv2.resize(frame, (round(w * scale), round(h * scale)))
                    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    ts = round(n / fps * 1000)
                    hand = hands.detect_for_video(image, ts)
                    body = pose.detect_for_video(image, ts)
                    points = np.zeros((48, 3), dtype=np.float32)
                    for group, handedness in zip(hand.hand_landmarks, hand.handedness):
                        offset = 0 if handedness[0].category_name == 'Left' else 21
                        points[offset:offset+21] = [[p.x, p.y, p.z] for p in group]
                    if body.pose_landmarks:
                        points[42:] = [[body.pose_landmarks[0][i].x, body.pose_landmarks[0][i].y,
                                       body.pose_landmarks[0][i].z] for i in POSE]
                    rows.append(points.reshape(-1))
                    timestamps.append(n / fps)
                n += 1
        if len(rows) < 4:
            raise ValueError(f'Insufficient frames: {video}')
        tmp = output.with_suffix('.tmp.npz')
        np.savez_compressed(tmp, rows=np.stack(rows), timestamps=np.array(timestamps), fingerprint=signature)
        tmp.replace(output)
        return sample['id'], len(rows)
    finally:
        cap.release()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers', type=int, default=2)
    args = parser.parse_args()
    (DATA / 'features').mkdir(exist_ok=True)
    samples = json.loads((DATA / 'manifest.json').read_text())['samples']
    start = time.monotonic()
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as pool:
        for i, result in enumerate(pool.map(extract, samples), 1):
            if i % 10 == 0 or i == len(samples):
                print(json.dumps(dict(complete=i, total=len(samples), seconds=round(time.monotonic()-start))), flush=True)


if __name__ == '__main__':
    main()
