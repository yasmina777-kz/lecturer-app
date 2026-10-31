"""Publish only motions linked to the current dictionary/alphabet references."""
from pathlib import Path
import json,struct,hashlib
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'frontend/public';OUT=PUBLIC/'avatars/sign-motion'
words=json.loads((PUBLIC/'research/rsl/words/catalog.json').read_text())
ids=[e['id'] for e in words]+[f'letter-{ord(c):x}' for c in 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ']
entries=[]
for id in ids:
 p=OUT/(id+'.json')
 if p.exists() and (OUT/(id+'.glb')).exists():
  entry=json.loads(p.read_text());raw=(OUT/(id+'.glb')).read_bytes();length=struct.unpack_from('<I',raw,12)[0];gltf=json.loads(raw[20:20+length]);entry['revision']=hashlib.sha256(raw).hexdigest()[:12];entry['duration']=max(gltf['accessors'][sampler['input']]['max'][0] for animation in gltf['animations'] for sampler in animation['samplers']);p.write_text(json.dumps(entry,ensure_ascii=False,indent=2));entries.append(entry)
assert len({e['id'] for e in entries})==len(entries)
(OUT/'catalog.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2))
(OUT/'ATTRIBUTION.txt').write_text('AI Mentor experimental motion adaptations. Source videos: Bukva and Slovo, https://github.com/ai-forever/bukva and https://github.com/ai-forever/slovo . Authors and full data licenses: /research/rsl/ATTRIBUTION.txt, /research/rsl/bukva-license.pdf, /research/rsl/words/ATTRIBUTION.txt, /research/rsl/words/license.pdf. These motion adaptations follow the same attribution/share-alike public license. No endorsement. Video paths, coverage and status recorded per entry in catalog.json. Motion captured with Google MediaPipe Hand/Pose Landmarker (Apache 2.0), retargeted with project-authored Blender code. Finger flexion axes and a body-only micro-motion layer are calibrated from Adobe Mixamo Talking and Standing Idle, retargeted to Mira; see /avatars/mixamo-trial/ATTRIBUTION.txt. Mixamo is not the source of RSL signs. No grammar model or new motion-generation model was trained. Not reviewed by RSL teachers. Facial grammar and mouth movements are not captured.\n')
report={'total':len(entries),'letters':sum(e['id'].startswith('letter-') for e in entries),'words':sum(e['id'].startswith('word-') for e in entries),'missing':[id for id in ids if id not in {e['id'] for e in entries}],'review':'experimental-unreviewed','limitations':['Tracking coverage is not gesture correctness.','Long occlusions are interpolated and can create wrong finger shapes.','No face/mouth grammar capture.','Hand/arm collisions have not been certified.','Text sequences retain Russian source order; no grammatical translation.'],'source':'MediaPipe tracking of Bukva/Slovo videos; Blender retargeting','qualityGate':{'minPoseCoverage':.85,'minDominantHandCoverage':.65,'maxHingeOffAxis':.0001,'motionVersion':5}}
report['observed']={'maxHingeOffAxis':max(e.get('maxHingeOffAxis',0) for e in entries),'maxJointStepDegrees':max(e['maxJointStepDegrees'] for e in entries),'v5Clips':sum(e.get('motionVersion')==5 for e in entries),'maxFinalWristErrorMeters':max(e.get('finalWristErrorMeters',0) for e in entries),'maxLegacyWristDriftMeters':max(e.get('legacyWristDriftMeters',0) for e in entries)}
(OUT/'quality-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(report['total'],'motions, missing',report['missing'])

# Refresh endpoint orientations whenever an authored/captured clip is replaced.
import subprocess
subprocess.run(['node',str(ROOT/'frontend/scripts/prepare-sign-transitions.mjs')],check=True)
