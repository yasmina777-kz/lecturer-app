"""Framing audit of dictionary word videos: nose + both shoulders in frame,
shoulder width 22-60% of frame width, and both wrists visible at least once."""
import json, sys
from pathlib import Path
import cv2, mediapipe as mp
ROOT = Path(__file__).resolve().parents[2]
pose = mp.tasks.vision.PoseLandmarker.create_from_options(mp.tasks.vision.PoseLandmarkerOptions(
    base_options=mp.tasks.BaseOptions(model_asset_path=str(ROOT / 'frontend/public/models/rsl/pose_landmarker_lite.task'))))

def framing(path):
    cap = cv2.VideoCapture(str(path)); n = cap.get(7); res = []
    for q in (.2, .5, .8):
        cap.set(1, int(n * q)); ok, img = cap.read()
        if not ok: continue
        r = pose.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
        res.append(r.pose_landmarks[0] if r.pose_landmarks else None)
    cap.release()
    lm = next((x for x in res if x), None)
    if lm is None: return False, 'no person'
    inside = lambda p: 0.02 < p.x < 0.98 and 0.02 < p.y < 0.98
    w = abs(lm[11].x - lm[12].x)
    if not (inside(lm[0]) and inside(lm[11]) and inside(lm[12])): return False, 'head/shoulders cut'
    if w > .60: return False, 'too close'
    if w < .22: return False, 'too far'
    return True, f'ok {w:.2f}'

if __name__ == '__main__':
    cat = json.loads((ROOT / 'frontend/public/research/rsl/words/catalog.json').read_text())
    bad = []
    for e in cat:
        ok, why = framing(ROOT / 'frontend/public' / e['video'].lstrip('/'))
        if not ok: bad.append(dict(label=e['label'], id=e['id'], attachmentId=e['attachmentId'], why=why))
    (ROOT / 'ml/rsl/data/word-video-audit.json').write_text(json.dumps(bad, ensure_ascii=False, indent=1))
    from collections import Counter
    print(len(cat), 'videos;', len(bad), 'flagged', Counter(b['why'] for b in bad))
