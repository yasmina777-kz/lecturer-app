"""Build training arrays for the Kazakh fingerspelling (KSL) recognizer.

QazSL: 44 folders × 2,400 binary 50×50 silhouettes (41 letters + delete,
space, nothing). No signer ids are published, so the held-out part is the
last 25 % of each folder by file number (a contiguous recording block), not
random frames. Bukva (Russian, CC BY-SA-style licence, signer-disjoint
train/test flags) supplies landmark tracks for the 33 letters shared with
the Kazakh alphabet; they are drawn with silhouette.render.
  ml/rsl/.venv/bin/python ml/ksl/build_data.py
"""
from __future__ import annotations
import csv, json, sys
from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ml/ksl'))
from silhouette import render  # noqa: E402

QZ = ROOT / 'ml/rsl/data/qazsl/raw/ksl_dataset_png'
BK = ROOT / 'ml/rsl/data/alphabet'
OUT = ROOT / 'ml/rsl/data/qazsl/arrays.npz'
LETTERS = list('АӘБВГҒДЕЁЖЗИЙКҚЛМНҢОӨПРСТУҰҮФХҺЦЧШЩЪЫІЬЭЮЯ')
LABELS = LETTERS + ['delete', 'space', 'nothing']
KAZAKH_ONLY = set('ӘҒҚҢӨҰҮҺІ')


def qazsl():
    names = {int(r['class_id']): r['label'] for r in csv.DictReader(open(QZ / 'classes.csv', encoding='utf-8'))}
    X, y, test = [], [], []
    for cid, name in sorted(names.items()):
        files = sorted((QZ / 'gestures_png' / str(cid)).glob('*.png'), key=lambda p: int(p.stem))
        cut = int(len(files) * .75)
        for i, f in enumerate(files):
            im = cv2.imread(str(f), cv2.IMREAD_GRAYSCALE)
            X.append(cv2.resize(im, (50, 50)) > 127)
            y.append(LABELS.index(name))
            test.append(i >= cut)
    return np.array(X, np.uint8), np.array(y, np.int16), np.array(test)


def bukva(per_clip=6):
    rows = json.load(open(BK / 'manifest.json', encoding='utf-8'))
    P, y, test, signer = [], [], [], []
    for r in rows:
        f = BK / 'features-v5' / (r['attachment_id'] + '.npz')
        if r['text'] not in LABELS or not f.exists():
            continue
        fr = np.load(f)['frames']
        b, e = int(r['begin']), int(r['end'])
        seg = fr[max(0, b):max(b + 1, e)]
        seg = seg[seg[:, 65] > 0]
        if len(seg) < 3:
            continue
        idx = np.linspace(len(seg) * .2, len(seg) * .8, per_clip).astype(int)
        for k in idx:
            P.append(seg[k, :63].reshape(21, 3))
            y.append(LABELS.index(r['text']))
            test.append(r['train'] == 'False')
            signer.append(r['user_id'])
    return np.array(P, np.float32), np.array(y, np.int16), np.array(test), np.array(signer)


if __name__ == '__main__':
    qx, qy, qt = qazsl()
    bp, by, bt, bs = bukva()
    print('qazsl', qx.shape, 'test', qt.sum(), '| bukva points', bp.shape, 'test', bt.sum(),
          'signers', len(set(bs[~bt])), len(set(bs[bt])))
    np.savez_compressed(OUT, qx=qx, qy=qy, qt=qt, bp=bp, by=by, bt=bt, bs=bs, labels=np.array(LABELS))
