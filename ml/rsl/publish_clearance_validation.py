"""Combine independent exported-motion checks; reject stale or missing results."""
from pathlib import Path
import argparse, hashlib, json
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'frontend/public/avatars/sign-motion'
parser = argparse.ArgumentParser()
parser.add_argument('--library', nargs='+', required=True)
parser.add_argument('--phrases', required=True)
parser.add_argument('--idle', required=True)
args = parser.parse_args()

def combine(paths):
    rows = {}
    for path in paths:
        report = json.loads(Path(path).read_text())
        assert report['sampleRate'] == 60
        for row in report['clips']:
            rows[row['id']] = row
    failed = [r['id'] for r in rows.values() if r['maxOverlapMeters'] > .002 or r.get('armAnatomy',{}).get('upperPlaneErrorDegrees',999)>8 or r.get('armAnatomy',{}).get('forearmRollDegrees',999)>86 or r.get('armAnatomy',{}).get('wristSwingDegrees',999)>66 or r.get('armAnatomy',{}).get('elbowPoleDeviationDegrees',999)>30 or r.get('armAnatomy',{}).get('wristEnvelope',999)>1.025]
    assert not failed, f'Unresolved exported motion violations: {failed}'
    return {'sampleRate': 60, 'toleranceMeters': .002,
            'clips': sorted(rows.values(), key=lambda r: r['id']), 'failed': failed}

library = combine(args.library)
expected = {e['id'] for e in json.loads((OUT/'catalog.json').read_text())} | {'ready-idle'}
assert {e['id'] for e in library['clips']} == expected, 'Incomplete library validation'
for row in library['clips']:
    actual = hashlib.sha256((OUT/(row['id']+'.glb')).read_bytes()).hexdigest()
    assert row.get('sha256') == actual, f'Stale validation for {row["id"]}'
phrases, idle = combine([args.phrases]), combine([args.idle])
assert len(phrases['clips']) == 32 and len(idle['clips']) == 78
sources = [
    'frontend/src/sign/composeMotion.ts', 'frontend/src/sign/motion.ts',
    'frontend/src/sign/avatarPlayback.ts', 'frontend/src/sign/phraseExamples.ts',
    'frontend/src/components/volumeSkinning.ts',
    'frontend/public/avatars/hand-workshop/mira-rig.glb',
    'art/hand-rig/Mira-Hand-Workshop.blend',
    'art/sign-motion/arm_anatomy.py', 'art/sign-motion/bake_arm_anatomy.py',
    'art/sign-motion/body_clearance.py', 'art/sign-motion/verify_body_clearance.py',
    'art/sign-motion/polish_release.py',
    'frontend/scripts/export-phrase-clearance-qa.mjs',
]
# Locate the skinning implementation without assuming its component folder.
if not (ROOT/sources[4]).exists():
    sources[4] = str(next((ROOT/'frontend/src').rglob('volumeSkinning.ts')).relative_to(ROOT))
result = {
    'method': 'Evaluated arm articulation limits and hand/forearm skin against torso, head and clothing front surfaces',
    'limitations': ['Not an arm-arm collision certificate.',
                    'Not a review of RSL meaning, finger accuracy or facial grammar.',
                    'Runtime checks cover 13 selected motions at 3 idle phases, start and finish.'],
    'sources': {p: hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sources},
    'library': library, 'phrases': phrases, 'idleTransitions': idle,
}
(OUT/'body-clearance-report.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print('Published clearance checks:', len(library['clips']), 'clips, 32 phrases, 78 idle transitions')
