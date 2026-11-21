"""Signer clips for the customer's answer with the hand points the AI sees.
  ml/rsl/.venv/bin/python promo-video/answer_clip.py
Writes build/answer/answer.mp4 (540x960, 30 fps) + words.json (start of each word)."""
import json
from pathlib import Path
import cv2, mediapipe as mp, numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'promo-video/build/answer'
WORDS = [('я', '0cca1e04-3f13-45e2-918c-190de5231e2a'), ('голова', '36e1eda6-db60-4d66-b934-87ead291358b'), ('болит', '96ccb10e-35a8-455a-a1ea-4c71baa13fbf')]
W, H = 540, 960
det = mp.tasks.vision.HandLandmarker.create_from_options(mp.tasks.vision.HandLandmarkerOptions(
    base_options=mp.tasks.BaseOptions(model_asset_path=str(ROOT / 'frontend/public/models/rsl/hand_landmarker.task')),
    running_mode=mp.tasks.vision.RunningMode.VIDEO, num_hands=2))
BONES = [(0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7), (7, 8), (5, 9), (9, 10), (10, 11), (11, 12), (9, 13), (13, 14), (14, 15), (15, 16), (13, 17), (17, 18), (18, 19), (19, 20), (0, 17)]
YELLOW = (40, 210, 250)  # BGR
writer = cv2.VideoWriter(str(OUT / 'answer-raw.mp4'), cv2.VideoWriter_fourcc(*'mp4v'), 30, (W, H))
starts, n, ts = [], 0, 0
for word, aid in WORDS:
    cap = cv2.VideoCapture(str(ROOT / f'frontend/public/research/rsl/words/{aid}.mp4'))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frames = []
    while True:
        ok, img = cap.read()
        if not ok:
            break
        frames.append(img)
    # keep the part with hands up (+ margins)
    found = []
    for i, img in enumerate(frames):
        r = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), ts); ts += int(1000 / fps)
        found.append(r.hand_landmarks)
    on = [i for i, f in enumerate(found) if f]
    a, b = (max(0, on[0] - 6), min(len(frames), on[-1] + 6)) if on else (0, len(frames))
    starts.append(n / 30)
    for i in range(a, b):
        img = frames[i]
        h, w = img.shape[:2]
        s = max(W / w, H / h)
        img = cv2.resize(img, (int(w * s), int(h * s)))
        y0, x0 = (img.shape[0] - H) // 2, (img.shape[1] - W) // 2
        img = img[y0:y0 + H, x0:x0 + W].copy()
        for hand in found[i] or []:
            pts = [(int(p.x * w * s - x0), int(p.y * h * s - y0)) for p in hand]
            for u, v in BONES:
                cv2.line(img, pts[u], pts[v], (255, 255, 255), 2, cv2.LINE_AA)
            for p in pts:
                cv2.circle(img, p, 5, YELLOW, -1, cv2.LINE_AA)
        writer.write(img); n += 1
writer.release()
(OUT / 'words.json').write_text(json.dumps({'starts': starts, 'duration': n / 30, 'words': [w for w, _ in WORDS]}))
print('ANSWER', n, 'frames', [round(x, 2) for x in starts])
