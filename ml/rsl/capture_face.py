"""Facial expression per frame (52 ARKit blendshapes) with MediaPipe Face Landmarker,
at the same timestamps as capture_motion.py. Output: data/face/<id>.json"""
import os
os.environ.setdefault("OMP_NUM_THREADS", "1")
from pathlib import Path
import json, sys, concurrent.futures, multiprocessing
import numpy as np, cv2, mediapipe as mp
from reference_store import source_path
ROOT = Path(__file__).resolve().parents[2]
MOTION = ROOT / "ml/rsl/data/motion"
OUT = ROOT / "ml/rsl/data/face"
OUT.mkdir(parents=True, exist_ok=True)

def capture(path):
    path = Path(path)
    dest = OUT / path.name
    if dest.exists():
        return path.stem, "cached"
    cap = json.loads(path.read_text())
    times = [f["t"] for f in cap["frames"]]
    v = cv2.VideoCapture(str(source_path(cap["entry"]["video"])))
    fps = v.get(cv2.CAP_PROP_FPS)
    wanted = {round(t * fps): t for t in times}
    base, vision = mp.tasks.BaseOptions, mp.tasks.vision
    opts = vision.FaceLandmarkerOptions(base_options=base(model_asset_path=str(MOTION / "face_landmarker.task")),
                                        running_mode=vision.RunningMode.VIDEO, output_face_blendshapes=True, num_faces=1)
    frames, i = [], 0
    with vision.FaceLandmarker.create_from_options(opts) as face:
        while True:
            ok, img = v.read()
            if not ok:
                break
            if i in wanted:
                h, w = img.shape[:2]
                k = min(1, 800 / max(h, w))
                img = cv2.resize(img, (max(1, round(w * k)), max(1, round(h * k))))
                r = face.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), round(i / fps * 1000))
                bs = {c.category_name: round(c.score, 3) for c in r.face_blendshapes[0]} if r.face_blendshapes else None
                frames.append({"t": wanted[i], "face": bs})
            i += 1
    v.release()
    found = sum(f["face"] is not None for f in frames) / max(1, len(frames))
    dest.write_text(json.dumps({"id": path.stem, "frames": frames, "coverage": round(found, 3)}))
    return path.stem, round(found, 3)

if __name__ == "__main__":
    files = sorted(str(p) for p in MOTION.glob("*.json"))
    with concurrent.futures.ProcessPoolExecutor(max_workers=4, mp_context=multiprocessing.get_context("spawn")) as pool:
        for n, res in enumerate(pool.map(capture, files)):
            print("FACE", n + 1, len(files), *res, flush=True)
