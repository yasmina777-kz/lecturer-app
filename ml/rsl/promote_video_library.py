"""Publish explicitly accepted, hash-verified video candidates and their sources.

An audit pass is a technical gate, not linguistic validation. Run audit first;
review candidates, then pass their IDs with --ids. Backups stay in ignored data.
"""
from pathlib import Path
import argparse, json, hashlib, shutil, cv2

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / 'ml/rsl/data/video-library-v1'
PUBLIC = ROOT / 'frontend/public'
OUT = PUBLIC / 'avatars/sign-motion'
parser = argparse.ArgumentParser()
parser.add_argument('--ids', nargs='+', required=True)
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
audit = json.loads((RUN / 'audit.json').read_text())
rows = {e['id']: e for e in audit['entries']}
selected = [rows[id] for id in args.ids]
assert len(set(args.ids)) == len(args.ids)
words_path = PUBLIC / 'research/rsl/words/catalog.json'
words = json.loads(words_path.read_text())
overrides_path = ROOT / 'ml/rsl/reference-overrides.json'
overrides = json.loads(overrides_path.read_text())
checks = []
for row in selected:
    assert row['status'] == 'candidate-ready', (row['id'], row['flags'])
    folder = Path(row['candidate'])
    id = row['candidateId']
    raw = (folder / (id + '.glb')).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row['sha256'], 'Candidate changed since audit'
    check = json.loads((folder / 'verification.json').read_text())
    assert not check['failed'] and len(check['clips']) == 1
    assert check['clips'][0]['sha256'] == row['sha256']
    meta = json.loads((folder / (id + '.json')).read_text())
    source = row['sourceEntry']
    assert meta['reference'] == source['video'] == row['reference']
    if source['video'].startswith('/'):
        file = RUN / 'source-public' / source['video'].lstrip('/')
        if not file.exists(): file = PUBLIC / source['video'].lstrip('/')
        assert file.exists(), 'Source movie missing'
    assert meta['sourceTimeline'] and meta['motionVersion'] == 9
    checked = dict(check['clips'][0], id=row['id'])
    checks.append(checked)
print('Validated', len(selected), 'candidates; apply:', args.apply)
if not args.apply: raise SystemExit()

backup = RUN / 'before-promotion'
backup.mkdir(exist_ok=True)
for name in ['catalog.json', 'body-clearance-report.json', 'quality-report.json']:
    if not (backup / name).exists(): shutil.copy2(OUT / name, backup / name)
for row in selected:
    id, source = row['id'], row['sourceEntry']
    folder = Path(row['candidate'])
    candidate_id = row['candidateId']
    for ext in ['json', 'glb']:
        if not (backup / (id + '.' + ext)).exists():
            shutil.copy2(OUT / (id + '.' + ext), backup / (id + '.' + ext))
    meta = json.loads((folder / (candidate_id + '.json')).read_text())
    meta.update(id=id, url='/avatars/sign-motion/' + id + '.glb')
    meta['videoRebuild'] = {
        'captureFps': 30, 'sourceKind': row['sourceKind'],
        'tracking': row['tracking'], 'linguisticReview': 'not-reviewed',
        'method': 'Pretrained landmark tracking, constrained Blender retargeting, saved motion replay',
    }
    shutil.copy2(folder / (candidate_id + '.glb'), OUT / (id + '.glb'))
    (OUT / (id + '.json')).write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    replacement = RUN / 'source-public' / source['video'].lstrip('/')
    if id.startswith('word-') and replacement.exists():
        shutil.copy2(replacement, PUBLIC / source['video'].lstrip('/'))
        cap = cv2.VideoCapture(str(replacement))
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(cap.get(cv2.CAP_PROP_FRAME_COUNT) * .5))
        ok, img = cap.read(); cap.release()
        assert ok, 'Source poster extraction failed'
        h, w = img.shape[:2]; scale = min(1, 480 / max(w, h))
        cv2.imwrite(str(PUBLIC / source['poster'].lstrip('/')), cv2.resize(img, (round(w * scale), round(h * scale))))
        words = [source if e['id'] == id else e for e in words]
        overrides[source['label']] = {'attachmentId': source['attachmentId'], 'stableId': id}
words_path.write_text(json.dumps(words, ensure_ascii=False, indent=2))
overrides_path.write_text(json.dumps(overrides, ensure_ascii=False, indent=2))
(RUN / 'promoted-verification.json').write_text(json.dumps({
    'sampleRate': 60, 'toleranceMeters': .002, 'clips': checks, 'failed': [],
}, ensure_ascii=False, indent=2))
summary = {
    'method': 'Saved video-derived motions; no new text-to-motion or RSL grammar model trained',
    'linguisticReview': 'not-reviewed',
    'catalogSize': len(rows), 'updated': len(selected),
    'lettersUpdated': sum(e['id'].startswith('letter-') for e in selected),
    'wholePhrasesUpdated': sum(e['id'].startswith('prepared-') for e in selected),
    'entries': [{
        'id': e['id'], 'label': e['label'],
        'status': 'updated' if e['id'] in args.ids else 'retained-previous',
        'candidateFlags': e['flags'],
        'candidateStatus': e['status'],
    } for e in audit['entries']],
}
(OUT / 'video-rebuild-report.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
print('Published', len(selected), 'saved motions. Refresh catalog and phrase/idle validation next.')
