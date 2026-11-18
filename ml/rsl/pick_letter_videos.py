"""Pick one Bukva clip per letter: among the top-12 ranked candidates
(select_letter_videos.py), require sensible framing — nose and both
shoulders in frame, shoulder width 25-55% of frame width (not too close, not
too far) — then take the highest score."""
import json
from pathlib import Path
import cv2, mediapipe as mp
ROOT = Path(__file__).resolve().parents[2]; DATA = ROOT / 'ml/rsl/data/alphabet'
cands = json.loads((DATA / 'letter-video-candidates.json').read_text())
opts = mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(ROOT / 'frontend/public/models/rsl/pose_landmarker_lite.task')))
pose = mp.tasks.vision.PoseLandmarker.create_from_options(opts)
picked = {}
for letter, items in cands.items():
    for c in items:
        cap = cv2.VideoCapture(str(DATA / (c['id'] + '.mp4'))); cap.set(1, int(cap.get(7) * .2)); ok, img = cap.read(); cap.release()
        if not ok: continue
        r = pose.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
        if not r.pose_landmarks: continue
        lm = r.pose_landmarks[0]
        inside = lambda i: 0.03 < lm[i].x < 0.97 and 0.03 < lm[i].y < 0.97
        width = abs(lm[11].x - lm[12].x)
        if inside(0) and inside(11) and inside(12) and .25 <= width <= .55 and lm[0].y > .12:
            picked[letter] = dict(c, shoulders=round(width, 2)); break
    if letter not in picked: picked[letter] = dict(items[0], shoulders=None)
(DATA / 'letter-video-picks.json').write_text(json.dumps(picked, ensure_ascii=False, indent=1))
print(sum(1 for v in picked.values() if v['shoulders']), 'of', len(picked), 'passed framing')
import numpy as np
from train_alphabet_v5 import LABELS
tiles = []
for letter in LABELS[:-1]:
    c = picked[letter]; cap = cv2.VideoCapture(str(DATA / (c['id'] + '.mp4'))); cap.set(1, int(cap.get(7) * .55)); ok, img = cap.read(); cap.release()
    img = cv2.resize(img, (120, 213)); cv2.putText(img, letter.encode('ascii', 'replace').decode(), (4, 16), cv2.FONT_HERSHEY_SIMPLEX, .45, (0, 255, 0), 1); tiles.append(img)
rows = [np.hstack(tiles[i:i + 11]) for i in range(0, 33, 11)]
cv2.imwrite('/private/tmp/claude-501/-Users-asminauldaseva-Desktop-AI-Mentor/b19c2466-6932-4524-8e05-145a0d2cae9d/scratchpad/letters-picked.jpg', np.vstack(rows))
