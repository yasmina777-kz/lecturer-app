"""Own recordings from /record-signs (exported JSON, landmarks only) → the same
per-video format as extract_slovo_origin.py, so build_word_windows_v7.py can
turn them into training windows:
  data/own-lm/<take id>.npz   hands [T,2,21,3] (NaN = no hand), pose [T,9,3], fps
  data/own-recordings/annotations.csv   attachment_id,text,user_id,width,height,begin,end
begin/end = first/last frame with a hand; the frames around it are real rest.
  .venv/bin/python -I import_recordings.py data/own-recordings/*.json
Then:  LM=data/own-lm ANN=data/own-recordings/annotations.csv OUT=data/own-word-windows.npz \\
       .venv/bin/python -I build_word_windows_v7.py
"""
import csv, json, sys
from pathlib import Path
import numpy as np

DATA = Path(__file__).resolve().parents[2] / 'ml/rsl/data'
LM = DATA / 'own-lm'; LM.mkdir(parents=True, exist_ok=True)
ANN = DATA / 'own-recordings/annotations.csv'; ANN.parent.mkdir(parents=True, exist_ok=True)
rows = {r['attachment_id']: r for r in csv.DictReader(ANN.open())} if ANN.exists() else {}
added = 0
for path in sys.argv[1:]:
    data = json.loads(Path(path).read_text())
    if data.get('format') != 'rsl-takes-v1':
        print('skip (not a recordings file):', path); continue
    for t in data['takes']:
        aid = 'own-' + t['id']
        T = len(t['t'])
        if aid in rows or T < 8:
            continue
        hands = np.full((T, 2, 21, 3), np.nan, np.float32)
        for i, frame in enumerate(t['hands']):
            for k, h in enumerate(frame[:2]):
                if h: hands[i, k] = np.asarray(h, np.float32)
        pose = np.asarray(t['pose'], np.float32).reshape(T, 9, 3)
        seen = np.where(~np.isnan(hands[:, 0, 0, 0]))[0]
        if len(seen) < 5:
            continue
        fps = (T - 1) * 1000.0 / max(1, t['t'][-1])
        np.savez_compressed(LM / (aid + '.npz'), hands=hands, pose=pose, fps=np.float32(fps))
        rows[aid] = dict(attachment_id=aid, text=t['label'], user_id='own:' + t['participant'],
                         width=t['width'], height=t['height'], begin=int(seen[0]), end=int(seen[-1]))
        added += 1
with ANN.open('w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['attachment_id', 'text', 'user_id', 'width', 'height', 'begin', 'end'])
    w.writeheader(); w.writerows(rows.values())
print('takes added', added, 'total', len(rows), 'signers', len({r['user_id'] for r in rows.values()}))
