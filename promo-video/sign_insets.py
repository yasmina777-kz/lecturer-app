"""Interpreter-window clips: real dictionary signer videos for the key words of
each presenter line (glosses chosen by meaning, RSL order; only signs that exist
in the platform dictionary). → build/insets/<line>.mp4 (720x720, 30 fps) + insets.json
  ml/rsl/.venv/bin/python promo-video/sign_insets.py"""
import json
from pathlib import Path
import cv2, mediapipe as mp, numpy as np

ROOT = Path(__file__).resolve().parents[1]
WORDS = ROOT / 'frontend/public/research/rsl/words'
OUT = ROOT / 'promo-video/build/insets'
OUT.mkdir(parents=True, exist_ok=True)
GLOSS = {'A': ['привет!', 'здесь', 'язык', 'изучить'], 'B': ['здесь', 'слово', 'тысяча'],
         'C': ['вы', 'писать', 'или', 'сказать', 'показать'], 'D': ['ваш', 'рука', 'переводить'], 'E': ['мы', 'все', 'понять']}
cat = {e['label'].lower().rstrip('!?') + ('!' if e['label'].endswith('!') else ''): e for e in json.load(open(WORDS / 'catalog.json'))}
det = mp.tasks.vision.HandLandmarker.create_from_options(mp.tasks.vision.HandLandmarkerOptions(
    base_options=mp.tasks.BaseOptions(model_asset_path=str(ROOT / 'frontend/public/models/rsl/hand_landmarker.task')),
    running_mode=mp.tasks.vision.RunningMode.VIDEO, num_hands=2))
S, ts, meta = 720, 0, {}
for line, gloss in GLOSS.items():
    w = cv2.VideoWriter(str(OUT / f'{line}-raw.mp4'), cv2.VideoWriter_fourcc(*'mp4v'), 30, (S, S))
    n, marks = 0, []
    for g in gloss:
        e = cat.get(g) or cat[g.rstrip('!')]
        cap = cv2.VideoCapture(str(ROOT / 'frontend/public' / (e.get('displayVideo') or e['video']).split('?')[0].lstrip('/')))
        frames = []
        while True:
            ok, img = cap.read()
            if not ok:
                break
            frames.append(img)
        on = []
        for i, img in enumerate(frames):
            r = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), ts); ts += 33
            if r.hand_landmarks:
                on.append(i)
        a, b = (max(0, on[0] - 4), min(len(frames), on[-1] + 4)) if on else (0, len(frames))
        marks.append([round(n / 30, 2), e['label'].rstrip('!?').upper()])
        for img in frames[a:b]:
            h, wd = img.shape[:2]
            side = min(h, wd) if wd > h else int(wd * 1.0)
            y0 = int(max(0, (h - side) * .25))  # keep head and hands, crop the legs
            crop = img[y0:y0 + side, (wd - side) // 2:(wd - side) // 2 + side]
            w.write(cv2.resize(crop, (S, S))); n += 1
    w.release()
    meta[line] = {'duration': round(n / 30, 2), 'signs': marks}
    print('INSET', line, round(n / 30, 1), 's', [m[1] for m in marks])
(OUT / 'insets.json').write_text(json.dumps(meta, ensure_ascii=False))
