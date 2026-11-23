"""Re-make an avatar sign from our own, well-lit recording (/record-signs,
«видео для аватара»). Usage:
  .venv/bin/python -I avatar_from_recording.py <video.webm|mp4> [<video> ...]
File names are «<слово>.webm» (as the page downloads them). For each video:
MediaPipe Pose (full) + Hands on every frame → ml/rsl/data/motion/<id>.json in
capture_motion.py's format (the old capture is kept in data/motion/slovo-original/), then
  Blender -b art/realistic-male/build/avatar.blend --python art/realistic-male/solve_video.py -- <ids>
  python3 art/realistic-male/build_catalog.py && python3 art/realistic-male/check_tracking.py
re-solve those signs (the commands are printed at the end).
"""
import json, shutil, sys, unicodedata
from pathlib import Path
import av, mediapipe as mp, numpy as np

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'frontend/public'
import os
MODELS = ROOT / 'ml/rsl/data/motion'
MOTION = Path(os.environ.get('MOTION_DIR', MODELS))
norm = lambda s: unicodedata.normalize('NFC', s).lower().strip().rstrip('!?.')
words = json.loads((PUBLIC / 'research/rsl/words/catalog.json').read_text())
letters = [{'id': f'letter-{ord(x):x}', 'label': x} for x in 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ']
by_label = {norm(e['label']): e for e in words + letters}


def capture(path, entry):
    vision, base = mp.tasks.vision, mp.tasks.BaseOptions
    frames, w, h = [], 1, 1
    with vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
            base_options=base(model_asset_path=str(MODELS / 'pose_landmarker_full.task')), running_mode=vision.RunningMode.VIDEO)) as pose, \
         vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
            base_options=base(model_asset_path=str(PUBLIC / 'models/rsl/hand_landmarker.task')), running_mode=vision.RunningMode.VIDEO,
            num_hands=2, min_hand_detection_confidence=.45, min_hand_presence_confidence=.45)) as hands:
        last = -1
        with av.open(str(path)) as c:
            for fr in c.decode(video=0):
                t = float(fr.time if fr.time is not None else len(frames) / 30)
                ms = int(round(t * 1000))
                if ms <= last:
                    continue
                last = ms
                img = fr.to_ndarray(format='rgb24')
                h, w = img.shape[:2]
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(img))
                p, hs = pose.detect_for_video(image, ms), hands.detect_for_video(image, ms)
                xyz = lambda pts: [[round(v.x, 6), round(v.y, 6), round(v.z, 6)] for v in pts]
                frames.append({'t': round(t, 4), 'pose': xyz(p.pose_landmarks[0]) if p.pose_landmarks else None,
                               'world': xyz(p.pose_world_landmarks[0]) if p.pose_world_landmarks else None,
                               'hands': [{'image': xyz(im), 'world': xyz(wo), 'side': sd[0].category_name}
                                         for im, wo, sd in zip(hs.hand_landmarks, hs.hand_world_landmarks, hs.handedness)]})
    if len(frames) < 8:
        raise ValueError('слишком короткое видео')
    t0 = frames[0]['t']
    for f in frames:
        f['t'] = round(f['t'] - t0, 4)
    fps = round((len(frames) - 1) / max(frames[-1]['t'], 1e-3))
    return {'sourceSha256': '', 'entry': {**entry, 'video': 'own:' + path.name}, 'duration': frames[-1]['t'], 'aspect': w / h,
            'frames': frames, 'poseCoverage': sum(bool(f['pose']) for f in frames) / len(frames), 'captureFps': fps}


ids = []
for arg in sys.argv[1:]:
    path = Path(arg)
    entry = by_label.get(norm(path.stem.split('__')[0]))
    if not entry:
        print('нет такого слова в словаре:', path.name); continue
    cap = capture(path, entry)
    dest = MOTION / (entry['id'] + '.json')
    keep = MOTION / 'slovo-original' / (entry['id'] + '.json')  # not matched by the solver's glob
    keep.parent.mkdir(exist_ok=True)
    if dest.exists() and not keep.exists():
        shutil.copy(dest, keep)
    dest.write_text(json.dumps(cap, ensure_ascii=False))
    hands_seen = sum(bool(f['hands']) for f in cap['frames']) / len(cap['frames'])
    print(f"{entry['label']}: {len(cap['frames'])} кадров, руки видны в {round(hands_seen * 100)}% кадров → {entry['id']}")
    ids.append(entry['id'])
if ids:
    B = '/Applications/Blender.app/Contents/MacOS/Blender'
    print('\nДальше:')
    print(f'{B} -b art/realistic-male/build/avatar.blend --python art/realistic-male/solve_video.py -- {" ".join(ids)}')
    print('python3 art/realistic-male/build_catalog.py && python3 art/realistic-male/check_tracking.py')
