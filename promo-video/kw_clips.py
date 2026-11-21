"""Real-signer clips for the ad: the hook phrase «Привет! Ты меня понимаешь?»
(ПРИВЕТ ТЫ Я ПОНЯТЬ, vertical card) and one keyword sign per section (square,
shown in a circle next to the heading). Dictionary videos, trimmed to the sign.
  ml/rsl/.venv/bin/python -I promo-video/kw_clips.py"""
import json
from pathlib import Path
import cv2, mediapipe as mp

ROOT = Path(__file__).resolve().parents[1]
B = ROOT / 'promo-video/build'
cat = {e['label'].lower().rstrip('!?'): e for e in json.load(open(ROOT / 'frontend/public/research/rsl/words/catalog.json'))}
det = mp.tasks.vision.HandLandmarker.create_from_options(mp.tasks.vision.HandLandmarkerOptions(
    base_options=mp.tasks.BaseOptions(model_asset_path=str(ROOT / 'frontend/public/models/rsl/hand_landmarker.task')),
    running_mode=mp.tasks.vision.RunningMode.VIDEO, num_hands=2))
ts = 0


def sign_frames(word, margin=4):
    global ts
    e = cat[word]
    cap = cv2.VideoCapture(str(ROOT / 'frontend/public' / (e.get('displayVideo') or e['video']).split('?')[0].lstrip('/')))
    fr = []
    while True:
        ok, img = cap.read()
        if not ok:
            break
        fr.append(img)
    on = []
    for i, img in enumerate(fr):
        r = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), ts); ts += 33
        if r.hand_landmarks:
            on.append(i)
    a, b = (max(0, on[0] - margin), min(len(fr), on[-1] + margin)) if on else (0, len(fr))
    return fr[a:b]


def crop(img, w, h, top=.15):
    H, W = img.shape[:2]
    s = max(w / W, h / H)
    im = cv2.resize(img, (int(W * s), int(H * s)), interpolation=cv2.INTER_CUBIC)
    y0 = int((im.shape[0] - h) * top); x0 = (im.shape[1] - w) // 2
    return im[y0:y0 + h, x0:x0 + w]


meta = {}
out = B / 'hookseq'; out.mkdir(exist_ok=True)
n, marks = 0, []
for w in ['привет', 'ты', 'я', 'понять']:
    marks.append([round(n / 30, 2), w.upper()])
    for img in sign_frames(w):
        n += 1; cv2.imwrite(str(out / f'{n:05d}.jpg'), crop(img, 720, 1080, .1), [cv2.IMWRITE_JPEG_QUALITY, 90])
meta['hook'] = {'frames': n, 'signs': marks}
for w in ['изучить', 'показать', 'слово', 'рука', 'язык', 'переводить', 'мой', 'понять']:
    d = B / 'kw' / w; d.mkdir(parents=True, exist_ok=True)
    k = 0
    for img in sign_frames(w):
        k += 1; cv2.imwrite(str(d / f'{k:05d}.jpg'), crop(img, 400, 400, .12), [cv2.IMWRITE_JPEG_QUALITY, 88])
    meta[w] = {'frames': k}
(B / 'kw.json').write_text(json.dumps(meta, ensure_ascii=False))
print('KW', {k: v['frames'] for k, v in meta.items()})
