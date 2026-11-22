"""Face channels (face_features.face_row) for every Slovo video, frame-aligned
with slovo_mediapipe.json. Reads from data/slovo-full/slovo.zip.
  .venv/bin/python extract_slovo_face.py   → data/slovo-face/<id>.npz [T, 21]"""
from pathlib import Path
import concurrent.futures, multiprocessing, os, sys, tempfile, time, zipfile
import cv2, mediapipe as mp, numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
from face_features import FACE, face_row

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'ml/rsl/data'
ZIP = DATA / 'slovo-full/slovo.zip'
OUT = DATA / 'slovo-face'
MODEL = DATA / 'motion/face_landmarker.task'
DET = ZF = TMP = None


def init():
    global DET, ZF, TMP
    cv2.setNumThreads(1)
    DET = mp.tasks.vision.FaceLandmarker.create_from_options(mp.tasks.vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL)), running_mode=mp.tasks.vision.RunningMode.VIDEO,
        output_face_blendshapes=True, num_faces=1))
    ZF = zipfile.ZipFile(ZIP); TMP = tempfile.mkdtemp(prefix='slovo-face-')


def process(name):
    aid = Path(name).stem
    out = OUT / (aid + '.npz')
    if out.exists():
        return 'cached'
    path = os.path.join(TMP, 'clip.mp4')
    with ZF.open(name) as src, open(path, 'wb') as dst:
        dst.write(src.read())
    cap = cv2.VideoCapture(path); fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    rows, i = [], 0
    while True:
        ok, img = cap.read()
        if not ok:
            break
        h, w = img.shape[:2]; f = min(1, 640 / max(h, w))
        img = cv2.resize(img, (max(1, int(w * f)), max(1, int(h * f))))
        r = DET.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), process.offset + int(i * 1000.0 / fps))
        if r.face_landmarks and r.face_blendshapes:
            blend = {c.category_name: c.score for c in r.face_blendshapes[0]}
            rows.append(face_row(blend, [(p.x, p.y) for p in r.face_landmarks[0]], w, h))
        else:
            rows.append([0.0] * FACE)
        i += 1
    cap.release()
    process.offset += int(i * 1000.0 / fps) + 10_000
    tmp = out.with_suffix('.tmp.npz')
    np.savez_compressed(tmp, face=np.asarray(rows, np.float32).reshape(-1, FACE)); tmp.replace(out)
    return 'done'


process.offset = 0
if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    names = [n for n in zipfile.ZipFile(ZIP).namelist() if n.lower().endswith('.mp4') and not Path(n).name.startswith('.')]
    print('videos', len(names), flush=True)
    t0, res = time.monotonic(), {}
    with concurrent.futures.ProcessPoolExecutor(max_workers=9, mp_context=multiprocessing.get_context('spawn'), initializer=init) as pool:
        for i, s in enumerate(pool.map(process, names, chunksize=8)):
            res[s] = res.get(s, 0) + 1
            if i % 1000 == 0:
                print('FACE', i + 1, len(names), res, round(time.monotonic() - t0), flush=True)
    print('FACE_COMPLETE', res, round(time.monotonic() - t0), flush=True)
