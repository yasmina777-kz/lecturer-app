"""Same test signers, same course list: v4 (hands) vs v5 (hands + body) ensembles.
  .venv/bin/python compare_words_v4_v5.py"""
import csv, hashlib, json
from pathlib import Path
import numpy as np
from seqnet import reference_forward
from word_features import resample

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'ml/rsl/data'
meta = {r['attachment_id']: r for r in csv.DictReader((DATA / 'slovo-annotations.csv').read_text().splitlines(), delimiter='\t')}
catalog = json.loads((ROOT / 'frontend/public/research/rsl/words/catalog.json').read_text())
course_texts = sorted({meta[w['attachmentId']]['text'] for w in catalog if w.get('attachmentId') in meta})


def run(feat_file, models):
    d = np.load(DATA / feat_file)
    x, off, ids = d['x'], d['offsets'], d['ids']
    sel = [i for i, a in enumerate(ids) if int(hashlib.sha256(meta[a]['user_id'].encode()).hexdigest()[:8], 16) % 10 < 2]
    ex = [json.loads((DATA / m / 'classifier.json').read_text()) for m in models]
    labels = ex[0]['labels']
    course = np.array([labels.index(t) for t in course_texts if t in labels])
    P, Y = [], []
    for i in sel:
        w = resample(x[off[i]:off[i + 1]].astype(np.float32), 32)
        P.append(np.mean([reference_forward(e, w) for e in ex], 0)); Y.append(labels.index(meta[ids[i]]['text']))
    P, Y = np.array(P)[:, :-1], np.array(Y)
    m = np.isin(Y, course)
    R = P[m][:, course]; cy = np.searchsorted(course, Y[m])
    top = lambda p, y, k: float(np.mean([y[j] in np.argsort(p[j])[-k:] for j in range(len(y))]))
    return dict(clips=len(Y), top1All=round(float((P.argmax(1) == Y).mean()), 4), top5All=round(top(P, Y, 5), 4),
                courseWords=len(course), courseClips=int(m.sum()), courseTop1=round(float((R.argmax(1) == cy).mean()), 4), courseTop3=round(top(R, cy, 3), 4))


print('v4', run('slovo-word-features-v3.npz', [f'slovo-word-v4-seed{s}' for s in (42, 7, 1234)]), flush=True)
print('v5', run('slovo-word-features-v5.npz', [f'slovo-word-v5-seed{s}' for s in (42, 7, 1234)]), flush=True)
