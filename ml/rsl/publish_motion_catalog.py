"""Publish only motions linked to the current dictionary/alphabet references."""
from pathlib import Path
import json,struct,hashlib
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'frontend/public';OUT=PUBLIC/'avatars/sign-motion'
words=json.loads((PUBLIC/'research/rsl/words/catalog.json').read_text())
ids=[e['id'] for e in words]+[f'letter-{ord(c):x}' for c in 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ']
ids += ['prepared-hello','prepared-thanks','prepared-name-demo']
entries=[]
for id in ids:
 p=OUT/(id+'.json')
 if p.exists() and (OUT/(id+'.glb')).exists():
  entry=json.loads(p.read_text())
  if entry.get('chartPose'):
   entry.setdefault('referenceTracking', {k:entry[k] for k in ['source','poseCoverage','handCoverage','maxGapFrames'] if k in entry})
   entry['source']=entry['chartPose']['source']
   for field in ['poseCoverage','handCoverage','maxGapFrames']:entry.pop(field,None)
  raw=(OUT/(id+'.glb')).read_bytes();length=struct.unpack_from('<I',raw,12)[0];gltf=json.loads(raw[20:20+length]);entry['revision']=hashlib.sha256(raw).hexdigest()[:12];entry['duration']=max(gltf['accessors'][sampler['input']]['max'][0] for animation in gltf['animations'] for sampler in animation['samplers']);p.write_text(json.dumps(entry,ensure_ascii=False,indent=2));entries.append(entry)
idle_path=OUT/'ready-idle.json'
idle=json.loads(idle_path.read_text());idle['revision']=hashlib.sha256((OUT/'ready-idle.glb').read_bytes()).hexdigest()[:12];idle_path.write_text(json.dumps(idle,ensure_ascii=False,indent=2))
assert len({e['id'] for e in entries})==len(entries)
assert len(entries)==len(ids), 'Incomplete motion library'
assert all(e.get('motionVersion')==8 and e.get('bodyClearance',{}).get('afterMaxMeters',1)<=.002 for e in entries), 'Run body-clearance correction on every clip before publishing'
(OUT/'catalog.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2))
(OUT/'ATTRIBUTION.txt').write_text('AI Mentor experimental motion adaptations. 32 alphabet clips use manually authored handshapes based on the user-provided chart /images/rsl-alphabet/source-chart.jpg; these retain linked Bukva videos for comparison, not as motion-capture claims. The remaining 171 letter/word clips use reference videos; prepared-hello, prepared-thanks and prepared-name-demo are rebaked project-authored phrases. Source videos: Bukva and Slovo, https://github.com/ai-forever/bukva and https://github.com/ai-forever/slovo . Authors and full data licenses: /research/rsl/ATTRIBUTION.txt, /research/rsl/bukva-license.pdf, /research/rsl/words/ATTRIBUTION.txt, /research/rsl/words/license.pdf. These motion adaptations follow the same attribution/share-alike public license. No endorsement. Video paths, coverage and status recorded per entry in catalog.json. Motion captured with Google MediaPipe Hand/Pose Landmarker (Apache 2.0), retargeted with project-authored Blender code. Finger flexion axes and a body-only micro-motion layer are calibrated from Adobe Mixamo Talking and Standing Idle, retargeted to Mira; see /avatars/mixamo-trial/ATTRIBUTION.txt. The ready-idle adaptation also uses Mixamo Standing Idle. Hand and forearm trajectories are corrected against the evaluated torso/head/clothing front surfaces. Mixamo is not the source of RSL signs. No grammar model or new motion-generation model was trained. Not reviewed by RSL teachers. Facial grammar and mouth movements are not captured.\n')
report={'total':len(entries),'letters':sum(e['id'].startswith('letter-') for e in entries),'words':sum(e['id'].startswith('word-') for e in entries),'preparedPhrases':sum(e['id'].startswith('prepared-') for e in entries),'missing':[id for id in ids if id not in {e['id'] for e in entries}],'review':'experimental-unreviewed','limitations':['Tracking coverage is not gesture correctness. For chart-authored clips it describes only the retained source video.', 'Chart poses and movement arrows require RSL teacher review; a drawing does not specify a complete motion.','Long occlusions are interpolated and can create wrong finger shapes.','No face/mouth grammar capture.','Front-surface clearance checks do not certify arm-arm contacts or linguistic correctness.','Text sequences retain Russian source order; no grammatical translation.'],'source':'32 chart-authored alphabet poses, 171 Bukva/Slovo reference adaptations and 3 project-authored phrases; Blender anatomical hand rebake','qualityGate':{'minPoseCoverage':.85,'minDominantHandCoverage':.65,'maxHingeOffAxis':.0001,'motionVersion':8,'maxUpperPlaneErrorDegrees':8,'maxForearmRollDegrees':86,'maxWristSwingDegrees':66,'maxElbowPoleDeviationDegrees':30}}
report['chartAuthoredLetters']=sum(bool(e.get('chartPose')) for e in entries)
report['observed']={'maxHingeOffAxis':max(e.get('maxHingeOffAxis',0) for e in entries),'maxJointStepDegrees':max(e['maxJointStepDegrees'] for e in entries),'v8Clips':sum(e.get('motionVersion')==8 for e in entries),'maxSourceWristFitErrorMeters':max(e.get('sourceWristFitErrorMeters',0) for e in entries),'maxBodyOverlapAfterMeters':max(e.get('bodyClearance',{}).get('afterMaxMeters',0) for e in entries),'maxBodyOverlapBeforeMeters':max(e.get('bodyClearance',{}).get('beforeMaxMeters',0) for e in entries),'maxLegacyWristDriftMeters':max(e.get('legacyWristDriftMeters',0) for e in entries)}
(OUT/'quality-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(report['total'],'motions, missing',report['missing'])

# Refresh endpoint orientations whenever an authored/captured clip is replaced.
import subprocess
subprocess.run(['node',str(ROOT/'frontend/scripts/prepare-sign-transitions.mjs')],check=True)
