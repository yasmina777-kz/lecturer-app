"""Contact sheets of actual Blender renders and corresponding source frames.
Run render_reference_candidates.py first. Output is private QA, not card art.
"""
from pathlib import Path
import sys, json, cv2, numpy as np
ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / 'ml/rsl/data/video-library-v1'
base = Path(sys.argv[1])
rows = json.loads((base / 'preview-manifest.json').read_text())
def tile(image, label):
    h, w = image.shape[:2]; scale = min(300 / h, 240 / w)
    image = cv2.resize(image, (int(w * scale), int(h * scale)))
    out = np.full((330, 240, 3), 240, np.uint8)
    x = (240 - image.shape[1]) // 2
    out[:image.shape[0], x:x + image.shape[1]] = image
    cv2.putText(out, label, (8, 320), 0, .5, (20, 20, 20), 1)
    return out
for id in sorted({e['id'] for e in rows}):
    images = []
    for e in [e for e in rows if e['id'] == id]:
        if e['source'].startswith('/'):
            path = RUN / 'source-public' / e['source'].lstrip('/')
            if not path.exists(): path = ROOT / 'frontend/public' / e['source'].lstrip('/')
        else: path = Path(e.get('folder',str(base/id))) / 'source-crop.mp4'
        cap = cv2.VideoCapture(str(path))
        cap.set(cv2.CAP_PROP_POS_MSEC, e['sourceTime'] * 1000)
        ok, original = cap.read(); cap.release()
        assert ok, str(path)
        images.extend([tile(cv2.imread(e['image']), 'Avatar %.2fs' % e['animationTime']), tile(original, 'Source %.2fs' % e['sourceTime'])])
    output = Path(next(e for e in rows if e['id']==id).get('folder',str(base/id))) / 'comparison.jpg'
    cv2.imwrite(str(output), cv2.hconcat(images))
    print(output)
