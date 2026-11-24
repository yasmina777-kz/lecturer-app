"""Hand landmarks from the SURDO.KZ letter clips (YouTube surdoKazakhstan:
each Kazakh letter from the front and often from the right and left).
Kept: frames with a raised, still hand in the middle 70 % of the clip.
Videos stay local (ml/rsl/data/surdo-letters/raw, git-ignored).
  ml/rsl/.venv/bin/python ml/ksl/extract_surdo_letters.py
"""
from __future__ import annotations
from pathlib import Path
import cv2
import mediapipe as mp
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
D = ROOT / 'ml/rsl/data/surdo-letters'
MODEL = ROOT / 'frontend/public/models/rsl/hand_landmarker.task'
LATIN = {'A': 'А', 'I': 'І', 'E': 'Е', 'O': 'О', 'H': 'Н', 'K': 'К', 'M': 'М', 'P': 'Р', 'C': 'С', 'T': 'Т', 'X': 'Х', 'B': 'В', 'Y': 'У'}


def main():
    rows = [l.split('\t') for l in (D / 'ids.tsv').read_text(encoding='utf-8').splitlines() if l.strip()]
    det = mp.tasks.vision.HandLandmarker.create_from_options(mp.tasks.vision.HandLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL)),
        running_mode=mp.tasks.vision.RunningMode.VIDEO, num_hands=2,
        min_hand_detection_confidence=.5, min_tracking_confidence=.6))
    P, Y, V, VID, offset, t = [], [], [], [], 0, 0
    for vid, letter, view in rows:
        letter = LATIN.get(letter, letter)
        f = next((D / 'raw').glob(f'{vid}.*'), None)
        if f is None:
            continue
        cap = cv2.VideoCapture(str(f)); fps = cap.get(5) or 25; n = int(cap.get(7)) or 1
        i, prev, kept = 0, None, 0
        while True:
            ok, img = cap.read()
            if not ok:
                break
            t = offset + int(i * 1000 / fps); i += 1
            r = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), t)
            if not r.hand_landmarks or not (.15 * n <= i <= .85 * n):
                prev = None
                continue
            k = min(range(len(r.hand_landmarks)), key=lambda j: r.hand_landmarks[j][0].y)
            im = np.array([[q.x, q.y] for q in r.hand_landmarks[k]])
            if im[0, 1] > .85:            # hand resting low, not signing
                prev = None
                continue
            pts = np.array([[q.x, q.y, q.z] for q in r.hand_world_landmarks[k]])
            pts = (pts - pts[0]) / max(np.linalg.norm(pts[0] - pts[9]), 1e-6)
            if r.handedness[k][0].category_name == 'Left':
                pts[:, 0] *= -1
            still = prev is not None and np.abs(im - prev).max() < .02
            prev = im
            if still:
                P.append(pts.astype(np.float32)); Y.append(letter); V.append(view); VID.append(vid); kept += 1
        offset = t + 10_000
        print(letter, view, vid, kept, flush=True)
    np.savez_compressed(D / 'landmarks.npz', points=np.array(P), labels=np.array(Y), view=np.array(V), video=np.array(VID))
    import collections
    print(len(P), collections.Counter(V), len(set(Y)), 'letters')


if __name__ == '__main__':
    main()
