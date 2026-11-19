"""Course-vocabulary mode: renormalize the word model over the 171 course labels.
Threshold/margin (0.5 / 0.2) were fixed before this evaluation was run."""
import csv, hashlib, json, sys
from pathlib import Path
import numpy as np
from fast_forward import forward as reference_forward
from word_features import resample
ROOT = Path(__file__).resolve().parents[2]; DATA = ROOT / 'ml/rsl/data'
models = [json.loads(Path(a).read_text()) for a in sys.argv[1:]]; model = models[0]
d = np.load(DATA / 'slovo-word-features-v3.npz')
meta = {r['attachment_id']: r for r in csv.DictReader((DATA / 'slovo-annotations.csv').read_text().splitlines(), delimiter='\t')}
labels = model['labels']; course = [labels.index(t) for t in model['courseLabels']]; cset = set(model['courseLabels'])
P, Y, TOP1_ALL = [], [], []
for i, cid in enumerate(d['ids']):
    r = meta[cid]
    if int(hashlib.sha256(r['user_id'].encode()).hexdigest()[:8], 16) % 10 >= 2 or r['text'] not in cset: continue
    w = resample(d['x'][d['offsets'][i]:d['offsets'][i + 1]].astype(np.float32), 32)
    full = np.mean([reference_forward(m, w) for m in models], 0); p = full[course]
    TOP1_ALL.append(full.argmax() == labels.index(r['text']))
    P.append(p / p.sum()); Y.append(model['courseLabels'].index(r['text']))
P, Y = np.array(P), np.array(Y); top = np.sort(P, 1); ok = P.argmax(1) == Y
out = dict(top1Among1000=float(np.mean(TOP1_ALL)), clips=len(Y), top1=float(ok.mean()), top3=float(np.mean([Y[i] in np.argsort(P[i])[-3:] for i in range(len(Y))])))
for t, m in ((.3, .1), (.4, .15), (.5, .2), (.6, .2)):
    acc = (top[:, -1] >= t) & (top[:, -1] - top[:, -2] >= m)
    out[f'accept@{t}/{m}'] = dict(coverage=float(acc.mean()), precision=float(ok[acc].mean()))
print(json.dumps(out, indent=1))
