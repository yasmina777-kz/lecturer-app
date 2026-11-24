"""Hand landmarks from the «Саусақтар сөйлейді» Kazakh fingerspelling lessons
(YouTube channel Sausaqtarsoileidi, Aktobe; one signer). Each lesson shows one
letter with a green ✓ (correct) or red ✗ (common mistake) mark at the left.
Only ✓ frames with a still, raised hand are kept. Videos stay local
(ml/rsl/data/sausaq/raw, git-ignored); only landmarks are used.
  ml/rsl/.venv/bin/python ml/ksl/extract_sausaq.py
"""
from __future__ import annotations
from pathlib import Path
import cv2
import mediapipe as mp
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
D = ROOT / 'ml/rsl/data/sausaq'
MODEL = ROOT / 'frontend/public/models/rsl/hand_landmarker.task'


def mark(img) -> str:
    """'ok' for a green check, 'bad' for a red cross, '' otherwise (left panel)."""
    h, w = img.shape[:2]
    roi = cv2.cvtColor(img[int(h * .6):int(h * .98), :int(w * .3)], cv2.COLOR_BGR2HSV)
    sat = roi[..., 1] > 120
    green = ((roi[..., 0] > 40) & (roi[..., 0] < 85) & sat).mean()
    red = (((roi[..., 0] < 8) | (roi[..., 0] > 170)) & sat).mean()
    return 'ok' if green > .01 and green > 3 * red else 'bad' if red > .01 else ''


def main():
    ids = [l.split('\t') for l in (D / 'ids.tsv').read_text(encoding='utf-8').splitlines() if l.strip()]
    opts = mp.tasks.vision.HandLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL)),
        running_mode=mp.tasks.vision.RunningMode.VIDEO, num_hands=2,
        min_hand_detection_confidence=.5, min_tracking_confidence=.6)
    det = mp.tasks.vision.HandLandmarker.create_from_options(opts)
    offset, P, Y, V, stats = 0, [], [], [], {}
    for vid, letter in ids:
        f = D / 'raw' / f'{vid}.mp4'
        if not f.exists():
            continue
        cap = cv2.VideoCapture(str(f)); fps = cap.get(5) or 25
        i, prev, kept = 0, None, 0
        while True:
            ok, img = cap.read()
            if not ok:
                break
            t = offset + int(i * 1000 / fps); i += 1
            if mark(img) != 'ok':
                prev = None
                continue
            r = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), t)
            if not r.hand_landmarks:
                prev = None
                continue
            # the letter hand is the raised one (smallest wrist y)
            k = min(range(len(r.hand_landmarks)), key=lambda j: r.hand_landmarks[j][0].y)
            im = np.array([[q.x, q.y] for q in r.hand_landmarks[k]])
            if im[:, 0].min() < .2:      # hand over the letter card → skip
                prev = None
                continue
            pts = np.array([[q.x, q.y, q.z] for q in r.hand_world_landmarks[k]])
            pts = (pts - pts[0]) / max(np.linalg.norm(pts[0] - pts[9]), 1e-6)
            if r.handedness[k][0].category_name == 'Left':
                pts[:, 0] *= -1
            still = prev is not None and np.abs(im - prev).max() < .02
            prev = im
            if still:
                P.append(pts.astype(np.float32)); Y.append(letter); V.append(vid); kept += 1
        offset = t + 10_000
        stats[letter] = kept
        print(letter, vid, kept, flush=True)
    np.savez_compressed(D / 'landmarks.npz', points=np.array(P), labels=np.array(Y), video=np.array(V))
    print(stats)


if __name__ == '__main__':
    main()
