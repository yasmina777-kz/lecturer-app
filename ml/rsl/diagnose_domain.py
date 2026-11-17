"""Compare word predictions from Slovo's published keypoints vs. landmarks
re-extracted with the browser's HandLandmarker (VIDEO mode, ~10 fps)."""
import json, sys
from pathlib import Path
import cv2, ijson, mediapipe as mp, numpy as np
from seqnet import reference_forward
from word_features import clip_features, resample
ROOT = Path(__file__).resolve().parents[2]
models = [json.loads((ROOT / f'frontend/public/models/rsl/{n}').read_text()) for n in
          ('words-v2-classifier.json', 'words-v2-seed7-classifier.json', 'words-v2-seed1234-classifier.json')]
def predict(feats):
    p = np.mean([reference_forward(m, resample(feats, 32)) for m in models], 0)
    course = [models[0]['labels'].index(t) for t in models[0]['courseLabels']]
    q = p[course] / p[course].sum(); o = np.argsort(q)[::-1][:3]
    return [(models[0]['courseLabels'][i], round(float(q[i]), 2)) for i in o]
def browser_like(path, step_ms=100):
    opts = mp.tasks.vision.HandLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(ROOT / 'frontend/public/models/rsl/hand_landmarker.task')),
        running_mode=mp.tasks.vision.RunningMode.VIDEO, num_hands=2, min_tracking_confidence=.7)
    det = mp.tasks.vision.HandLandmarker.create_from_options(opts)
    cap = cv2.VideoCapture(str(path)); fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frames, i, next_t = [], 0, 0.
    while True:
        ok, img = cap.read()
        if not ok: break
        t = i * 1000 / fps; i += 1
        if t + 1e-6 < next_t: continue
        next_t += step_ms
        h, w = img.shape[:2]; s = 640 / max(h, w); img = cv2.resize(img, (int(w * s), int(h * s)))
        r = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), int(t))
        frames.append([np.array([[p.x, p.y, p.z] for p in hand]) for hand in r.hand_landmarks])
    return frames, w, h
ids = sys.argv[1:]
slovo = {}
with (ROOT / 'ml/rsl/data/slovo_mediapipe.json').open('rb') as f:
    for k, v in ijson.kvitems(f, '', use_float=True):
        if k in ids: slovo[k] = v
        if len(slovo) == len(ids): break
import csv
meta = {r['attachment_id']: r for r in csv.DictReader((ROOT / 'ml/rsl/data/slovo-annotations.csv').read_text().splitlines(), delimiter='\t')}
for cid in ids:
    r = meta[cid]
    fr = [[np.array([[p['x'], p['y'], p['z']] for p in pts]) for pts in (x or {}).values() if len(pts) == 21] for x in slovo[cid]]
    print(r['text'], 'slovo-json:', predict(clip_features(fr, float(r['width']), float(r['height']))), 'frames', len(fr))
    for step in (33.3, 100):
        b, w, h = browser_like(ROOT / f'frontend/public/research/rsl/words/{cid}.mp4', step)
        print('   browser-like', step, 'ms:', predict(clip_features(b, w, h)), 'frames', len(b), 'with hands', sum(bool(x) for x in b))
