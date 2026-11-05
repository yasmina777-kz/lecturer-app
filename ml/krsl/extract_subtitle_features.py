"""Cache actual Holistic observations for subtitle-supervised translation research.

Subtitles are weak translation targets, NOT ordered gesture glosses. This cache
is deliberately separate from the serving CTC checkpoint and its training data.
"""
import argparse
import hashlib
import json
import time
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

from prepare_youtube_corpus import digest
from runtime import DATA, vector


def fingerprint(source):
    spec = dict(video=source['videoSha256'], model=digest(DATA / 'holistic_landmarker.task'),
                extractor=digest(Path(__file__)), runtime=digest(Path(__file__).with_name('runtime.py')),
                opencv=cv2.__version__, mediapipe=mp.__version__, numpy=np.__version__,
                sampling='every round(fps/12) frames', mode='IMAGE')
    return hashlib.sha256(json.dumps(spec, sort_keys=True).encode()).hexdigest()


def extract(source, output):
    output.mkdir(parents=True, exist_ok=True)
    target = output / (source['video_id'] + '.npz')
    key = fingerprint(source)
    if target.exists():
        with np.load(target, allow_pickle=False) as cached:
            if str(cached['fingerprint']) == key:
                print(json.dumps(dict(video=source['video_id'], cached=True, frames=len(cached['rows']))), flush=True)
                return
    if digest(Path(source['video'])) != source['videoSha256']:
        raise ValueError('Source video changed since corpus audit')
    options = mp.tasks.vision.HolisticLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(DATA / 'holistic_landmarker.task')),
        running_mode=mp.tasks.vision.RunningMode.IMAGE)
    cap = cv2.VideoCapture(source['video'])
    rows, timestamps = [], []
    started = time.monotonic()
    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        if not cap.isOpened() or not np.isfinite(fps) or not 1 <= fps <= 120:
            raise ValueError('Cannot decode source video')
        step = max(1, round(fps / 12))
        n = 0
        with mp.tasks.vision.HolisticLandmarker.create_from_options(options) as detector:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                if n % step == 0:
                    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    rows.append(vector(detector.detect(image)))
                    timestamps.append(n / fps)
                    if len(rows) % 1000 == 0:
                        print(json.dumps(dict(video=source['video_id'], frames=len(rows),
                                              videoSeconds=round(n / fps), elapsed=round(time.monotonic()-started))), flush=True)
                n += 1
        if not rows or abs(n / fps - source['duration']) > 2:
            raise ValueError('Incomplete decode; refusing to cache partial source')
        # Atomic save; interrupted extraction cannot masquerade as a full cache.
        temporary = target.with_suffix('.tmp.npz')
        np.savez_compressed(temporary, rows=np.asarray(rows, dtype=np.float32),
                            timestamps=np.asarray(timestamps), fingerprint=key)
        temporary.replace(target)
        print(json.dumps(dict(video=source['video_id'], complete=True, frames=len(rows),
                              elapsed=round(time.monotonic()-started))), flush=True)
    finally:
        cap.release()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audit', type=Path, default=DATA / 'sources/youtube-sl-25/review/source-audit.json')
    parser.add_argument('--output', type=Path, default=DATA / 'subtitle-features')
    args = parser.parse_args()
    for source in json.loads(args.audit.read_text())['sources']:
        extract(source, args.output)
