"""Acquire a bounded Slovo expression experiment; never invent sentence labels.

All people are separated afresh: upstream IDs overlap across official splits.
Validation and test people are selected solely from
annotation counts, before features or predictions exist. Other signs are used
to measure out-of-vocabulary rejection, with different negative labels per split.
"""
import concurrent.futures
import csv
import hashlib
import json
import numpy as np
import shutil
import threading
from pathlib import Path

from remotezip import RemoteZip

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'ml/krsl/data/expressions'
URL = 'https://rndml-team-cv.obs.ru-moscow-1.hc.sbercloud.ru/datasets/slovo/slovo.zip'
LABELS = ['Добро пожаловать!', 'С днем рождения', 'еще нет', 'так себе',
          'день и ночь', 'в этом году', 'в прошлом году', 'Привет!', 'Пока',
          'помочь', 'понять', 'вопрос']
NEGATIVES = {'train': ['кошка', 'вода', 'книга', 'работать'],
             'val': ['красный', 'семья'], 'test': ['магазин', 'вчера']}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_manifest(rows):
    known = [r for r in rows if r['text'] in LABELS]
    assert all(sum(r['text'] == label for r in known) == 20 for label in LABELS)
    people = sorted({r['user_id'] for r in known})
    counts = np.array([[sum(r['user_id'] == person and r['text'] == label
                            for r in known) for label in LABELS] for person in people])
    rng = np.random.default_rng(42)
    best = None
    for _ in range(50000):
        order = rng.permutation(len(people))
        size = max(3, len(people) // 5)
        test, val = order[:size], order[size:2*size]
        tc, vc = counts[test].sum(0), counts[val].sum(0)
        if min(tc) >= 3 and min(vc) >= 2 and min(20 - tc - vc) >= 7:
            score = int(abs(tc - 4).sum() + abs(vc - 4).sum())
            if best is None or score < best[0]:
                best = score, test, val
    if best is None:
        raise ValueError('Cannot produce balanced signer-disjoint splits')
    test_people = {people[i] for i in best[1]}
    val_people = {people[i] for i in best[2]}
    selected = []
    for r in rows:
        label = r['text']
        if label in LABELS:
            split = 'test' if r['user_id'] in test_people else ('val' if r['user_id'] in val_people else 'train')
            target = LABELS.index(label)
        else:
            split = next((s for s, labels in NEGATIVES.items() if label in labels), None)
            if split is None:
                continue
            assigned = 'test' if r['user_id'] in test_people else ('val' if r['user_id'] in val_people else 'train')
            if assigned != split:
                continue
            target = -1
        selected.append(dict(id=r['attachment_id'], signer=r['user_id'], label=label,
                             target=target, split=split,
                             member=('train/' if r['train'] == 'True' else 'test/') + r['attachment_id'] + '.mp4'))
    people = {s: {r['signer'] for r in selected if r['split'] == s} for s in ('train', 'val', 'test')}
    assert all(not people[a] & people[b] for a, b in [('train', 'val'), ('train', 'test'), ('val', 'test')])
    return dict(version=1, source='https://github.com/ai-forever/slovo', archive=URL,
                scope='isolated expressions and words; not continuous translation',
                labels=LABELS, negatives=NEGATIVES, samples=selected)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'videos').mkdir(exist_ok=True)
    source = ROOT / 'ml/rsl/data/slovo-annotations.csv'
    manifest = build_manifest(list(csv.DictReader(source.read_text().splitlines(), delimiter='\t')))
    manifest['annotationsSha256'] = sha(source)
    # Persist the split BEFORE downloading/extracting/evaluating.
    plan = OUT / 'split-plan.json'
    encoded = json.dumps(manifest, ensure_ascii=False, indent=2)
    if plan.exists() and plan.read_text() != encoded:
        raise ValueError('Existing experiment has a different split; use a new directory')
    plan.write_text(encoded)
    local = threading.local()

    def fetch(row):
        dest = OUT / 'videos' / (row['id'] + '.mp4')
        if not dest.exists():
            for directory in [ROOT / 'ml/rsl/data', ROOT / 'frontend/public/research/rsl/words']:
                existing = directory / dest.name
                if existing.exists():
                    shutil.copyfile(existing, dest)
                    break
            else:
                if not getattr(local, 'archive', None):
                    local.archive = RemoteZip(URL, timeout=90)
                tmp = dest.with_suffix('.tmp')
                tmp.write_bytes(local.archive.read(row['member']))
                tmp.replace(dest)
        return dict(row, video=str(dest), videoSha256=sha(dest))

    samples = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for row in pool.map(fetch, manifest['samples']):
            samples.append(row)
            if len(samples) % 20 == 0:
                print(f'Downloaded {len(samples)}/{len(manifest["samples"])}', flush=True)
    manifest['samples'] = samples
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(json.dumps({s: sum(r['split'] == s for r in samples) for s in ['train', 'val', 'test']}), flush=True)


if __name__ == '__main__':
    main()
