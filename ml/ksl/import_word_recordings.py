"""Kazakh word recordings from /help-ksl or /record-signs?lang=ksl (exported JSON,
landmarks only, no video) → word features like extract_words.py, appended to
ml/rsl/data/ksl-words/own.npz (one clip per take, signer = participant).

  ml/rsl/.venv/bin/python -I ml/ksl/import_word_recordings.py ~/Downloads/ksl-recordings-*.json
  ml/rsl/.venv/bin/python -I ml/ksl/ksl_words_probe.py eval    # adds a leave-one-person-out check
  ml/rsl/.venv/bin/python -I ml/ksl/ksl_words_probe.py final   # retrains the browser model with them
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ml/rsl'))
from word_features import clip_features  # noqa: E402

OWN = ROOT / 'ml/rsl/data/ksl-words/own.npz'


def take_features(t: dict) -> np.ndarray | None:
    hands = [[np.asarray(h, np.float64) for h in frame if h] for frame in t['hands']]
    pose = np.asarray(t['pose'], np.float32).reshape(len(t['hands']), 9, 3)
    seen = [i for i, f in enumerate(hands) if f]
    if len(seen) < 5:
        return None
    x = clip_features(hands, float(t['width']), float(t['height']), pose)
    return None if x is None or len(x) < 4 else x.astype(np.float16)


def load_own():
    if not OWN.exists():
        return [], []
    d = np.load(OWN)
    meta = json.loads(str(d['meta']))
    off = d['offsets']
    return [d['x'][off[i]:off[i + 1]].astype(np.float32) for i in range(len(meta))], meta


def main(paths):
    labels = {e['label'] for e in json.loads((ROOT / 'frontend/public/research/ksl/surdo-catalog.json').read_text())['entries']}
    X, meta = load_own()
    X = [x.astype(np.float16) for x in X]
    known = {m['id'] for m in meta}
    added = skipped = 0
    for p in paths:
        data = json.loads(Path(p).read_text())
        if data.get('format') != 'rsl-takes-v1':
            print('skip (not a recordings file):', p)
            continue
        for t in data['takes']:
            if t.get('lang') != 'ksl' or t['id'] in known or t['label'] not in labels:
                skipped += 1
                continue
            x = take_features(t)
            if x is None:
                skipped += 1
                continue
            X.append(x)
            meta.append(dict(id=t['id'], label=t['label'], signer='own:' + t['participant'].strip().lower(),
                             source='own', kind='camera', video=t['id']))
            known.add(t['id'])
            added += 1
    if not X:
        print('no Kazakh takes found')
        return
    off = np.cumsum([0] + [len(x) for x in X])
    OWN.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(OWN, x=np.concatenate(X), offsets=off, meta=json.dumps(meta, ensure_ascii=False))
    people = sorted({m['signer'] for m in meta})
    print(f'added {added}, skipped {skipped}; total {len(meta)} takes, {len({m["label"] for m in meta})} words, {len(people)} people: {people}')


if __name__ == '__main__':
    main(sys.argv[1:])
