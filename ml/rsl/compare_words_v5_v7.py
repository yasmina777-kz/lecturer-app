"""v5 (shipped) vs v7 on the SAME held-out signers, with browser-model
landmarks from the untrimmed videos (build_word_windows_v7.py):
  * signs:     top-1 among all words and among course words, how often the
               model says "no sign" on a real sign;
  * rest/edge: how often a real non-sign window is called a word with
               confidence ≥ 0.4 (the live spotter's threshold) — false words.
  .venv/bin/python -I compare_words_v5_v7.py
"""
import os as _os, sys as _sys; _sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
import csv, hashlib, json
from pathlib import Path
import numpy as np
from seqnet import reference_forward
from word_features import resample

ROOT = Path(__file__).resolve().parents[2]; DATA = ROOT / 'ml/rsl/data'
text = (DATA / 'slovo-origin/annotations.csv').read_text()
meta = {r['attachment_id']: r for r in csv.DictReader(text.splitlines(), delimiter='\t' if '\t' in text[:500] else ',')}
catalog = json.loads((ROOT / 'frontend/public/research/rsl/words/catalog.json').read_text())
course = sorted({meta[w['attachmentId']]['text'] for w in catalog if w.get('attachmentId') in meta})
d = np.load(DATA / 'slovo-word-windows-v7.npz')
x, off, ids, labels, kinds = d['x'], d['offsets'], d['ids'], d['labels'], d['kinds']
test = [i for i, a in enumerate(ids) if int(hashlib.sha256(meta[a]['user_id'].encode()).hexdigest()[:8], 16) % 10 < 2]


def score(name, dirs):
    ex = [json.loads((DATA / m / 'classifier.json').read_text()) for m in dirs]
    L = ex[0]['labels']; none = L.index('__none__'); C = [L.index(t) for t in course if t in L]
    sign_ok = sign_course_ok = sign_none = n_sign = false = n_neg = 0
    for i in test:
        w = resample(x[off[i]:off[i + 1]].astype(np.float32), 32)
        p = np.mean([reference_forward(e, w) for e in ex], 0)
        if kinds[i] == 'sign':
            if labels[i] not in L: continue
            n_sign += 1; y = L.index(labels[i])
            sign_none += int(p.argmax() == none)
            q = p.copy(); q[none] = -1; sign_ok += int(q.argmax() == y)
            if y in C: sign_course_ok += int(C[int(np.argmax(p[C]))] == y)
        else:
            n_neg += 1
            q = p[C] / p[C].sum()
            false += int(p.argmax() != none and q.max() >= .4)
    n_course = sum(1 for i in test if kinds[i] == 'sign' and labels[i] in course)
    print(name, json.dumps(dict(signs=n_sign, top1=round(sign_ok / n_sign, 4), courseTop1=round(sign_course_ok / max(n_course, 1), 4),
                                noneOnRealSigns=round(sign_none / n_sign, 4), negatives=n_neg,
                                falseWordsOnRest=round(false / max(n_neg, 1), 4)), ensure_ascii=False), flush=True)


score('v5', [f'slovo-word-v5-seed{s}' for s in (42, 7, 1234)])
import os
score('v7', [f'slovo-word-v7-seed{s}' for s in os.environ.get('V7_SEEDS', '42,7,1234').split(',')])
