"""faceRow parity fixtures: real Face Landmarker outputs on a few Slovo frames,
with the Python face_row result. → frontend/public/models/rsl/face-row-fixtures.json"""
import json, sys, zipfile, tempfile, os
from pathlib import Path
import cv2, mediapipe as mp
sys.path.insert(0, str(Path(__file__).resolve().parent))
from face_features import face_row

ROOT = Path(__file__).resolve().parents[2]
Z = zipfile.ZipFile(ROOT / 'ml/rsl/data/slovo-full/slovo.zip')
det = mp.tasks.vision.FaceLandmarker.create_from_options(mp.tasks.vision.FaceLandmarkerOptions(
    base_options=mp.tasks.BaseOptions(model_asset_path=str(ROOT / 'ml/rsl/data/motion/face_landmarker.task')), output_face_blendshapes=True, num_faces=1))
out = []
for name in [n for n in Z.namelist() if n.endswith('.mp4')][100:106]:
    tmp = os.path.join(tempfile.mkdtemp(), 'c.mp4'); open(tmp, 'wb').write(Z.read(name))
    cap = cv2.VideoCapture(tmp); n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); cap.set(cv2.CAP_PROP_POS_FRAMES, n // 2)
    ok, img = cap.read()
    if not ok: continue
    h, w = img.shape[:2]
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
    if not r.face_landmarks: continue
    blend = {c.category_name: round(c.score, 6) for c in r.face_blendshapes[0]}
    lm = [[round(p.x, 6), round(p.y, 6)] for p in r.face_landmarks[0]]
    out.append(dict(blend=blend, landmarks=lm, width=w, height=h, row=face_row(blend, lm, w, h)))
(ROOT / 'frontend/public/models/rsl/face-row-fixtures.json').write_text(json.dumps(out))
print('FACE_FIXTURES', len(out))
