"""Rank Bukva clips per letter for the reference video shown to learners.
Score: hand visible in every frame, large hand, wrist away from frame edges,
portrait recording, and the v5 model recognizing the letter confidently."""
import csv, json
from pathlib import Path
import numpy as np, cv2
from seqnet import reference_forward
from train_alphabet_v5 import normalize_window, whole_clip, LABELS
ROOT = Path(__file__).resolve().parents[2]; DATA = ROOT / 'ml/rsl/data/alphabet'
model = json.loads((ROOT / 'frontend/public/models/rsl/alphabet-v5-classifier.json').read_text())
rows = json.loads((DATA / 'manifest.json').read_text())
meta = {r['attachment_id']: r for r in csv.DictReader((ROOT / 'ml/rsl/data/annotations.tsv').read_text().splitlines(), delimiter='\t')}
out = {}
for r in rows:
    if r['text'] == 'no_event': continue
    f = DATA / 'features-v5' / (r['attachment_id'] + '.npz')
    if not f.exists(): continue
    d = np.load(f); fr = d['frames']
    vis = (fr[:, 65] > 0).mean()
    if vis < .9: continue
    m = meta[r['attachment_id']]; w, h = int(m['width']), int(m['height'])
    if h < w or h < 1000: continue  # portrait, good resolution
    wx, wy, size = np.abs(fr[fr[:, 65] > 0, 63]), fr[fr[:, 65] > 0, 64], np.median(fr[fr[:, 65] > 0, 65])
    edge = min(wx.min(), 1 - wx.max(), wy.min(), 1 - wy.max())
    if edge < .08: continue
    p = reference_forward(model, normalize_window(whole_clip(fr)))
    conf = float(p[LABELS.index(r['text'])])
    score = conf * vis * min(1, size / .09) * min(1, edge / .15)
    out.setdefault(r['text'], []).append(dict(id=r['attachment_id'], score=round(score, 3), conf=round(conf, 2), size=round(float(size), 3), edge=round(float(edge), 2), dur=round(float(d['times'][-1]) / 1000, 2)))
best = {k: sorted(v, key=lambda x: -x['score'])[:12] for k, v in out.items()}
(DATA / 'letter-video-candidates.json').write_text(json.dumps(best, ensure_ascii=False, indent=1))
print({k: len(v) for k, v in out.items()})
# contact sheet: 4 candidates x 33 letters, middle frame each
thumbs = []
for letter in LABELS[:-1]:
    row = []
    for c in best.get(letter, [])[:4]:
        cap = cv2.VideoCapture(str(DATA / (c['id'] + '.mp4'))); n = cap.get(7); cap.set(1, int(n * .5)); ok, img = cap.read(); cap.release()
        img = cv2.resize(img, (90, 160)) if ok else np.zeros((160, 90, 3), np.uint8)
        cv2.putText(img, f"{c['conf']:.2f}", (3, 155), cv2.FONT_HERSHEY_SIMPLEX, .4, (0, 255, 0), 1)
        row.append(img)
    while len(row) < 4: row.append(np.zeros((160, 90, 3), np.uint8))
    thumbs.append(np.hstack(row))
sheet = np.vstack([np.hstack(thumbs[i:i + 3]) if len(thumbs[i:i + 3]) == 3 else np.hstack(thumbs[i:i + 3] + [np.zeros((160, 360, 3), np.uint8)] * (3 - len(thumbs[i:i + 3]))) for i in range(0, 33, 3)])
cv2.imwrite('/private/tmp/claude-501/-Users-asminauldaseva-Desktop-AI-Mentor/b19c2466-6932-4524-8e05-145a0d2cae9d/scratchpad/letters-sheet.jpg', sheet)
