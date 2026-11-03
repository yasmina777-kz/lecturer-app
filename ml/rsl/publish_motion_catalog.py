"""Publish only motions linked to the current dictionary/alphabet references."""
from pathlib import Path
import json,struct,hashlib,os
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'frontend/public';OUT=Path(os.environ.get('MOTION_OUTPUT_DIR',str(PUBLIC/'avatars/sign-motion')))
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
assert all(e.get('motionVersion')==9 and e.get('bodyClearance',{}).get('afterMaxMeters',1)<=.002 for e in entries), 'Run body-clearance correction on every clip before publishing'
(OUT/'catalog.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2))
chart_count=sum(bool(e.get('chartPose')) for e in entries)
teacher_count=sum(bool(e.get('sourceRecording')) for e in entries)
captured_count=sum(bool(e.get('sourceTimeline')) for e in entries)
(OUT/'ATTRIBUTION.txt').write_text(f"AI Mentor experimental motion adaptations. {chart_count} alphabet clips retain manually authored handshapes from the user-provided chart. {captured_count} clips carry an explicit video-to-animation timeline; {teacher_count} of these use whole-phrase VOG teaching references. Every source is identified in catalog.json. Remaining legacy motions retain their own source/method metadata. Bukva/Slovo sources: https://github.com/ai-forever/bukva and https://github.com/ai-forever/slovo . Original authors and attribution/share-alike licenses: /research/rsl/ATTRIBUTION.txt, /research/rsl/bukva-license.pdf, /research/rsl/words/ATTRIBUTION.txt, /research/rsl/words/license.pdf. Bukva/Slovo motion adaptations follow those data licenses. VOG teacher recordings remain external links and are not redistributed; their publication does not imply an open license or endorsement. MediaPipe Hand/Pose Landmarker is pretrained (Apache 2.0). Blender retargeting code is project-authored. Mixamo Talking/Standing Idle calibrate joint axes and body micro-motion, not RSL signs; see /avatars/mixamo-trial/ATTRIBUTION.txt. No grammar or motion-generation model was trained. Technical geometry/tracking checks are not linguistic review. Facial grammar and mouth movements are not captured.\n")
report={'total':len(entries),'letters':sum(e['id'].startswith('letter-') for e in entries),'words':sum(e['id'].startswith('word-') for e in entries),'preparedPhrases':sum(e['id'].startswith('prepared-') for e in entries),'missing':[id for id in ids if id not in {e['id'] for e in entries}],'review':'experimental-unreviewed','limitations':['Tracking coverage is not gesture correctness. For chart-authored clips it describes only the retained source video.', 'Chart poses and movement arrows require RSL teacher review; a drawing does not specify a complete motion.','Long occlusions are interpolated and can create wrong finger shapes.','No face/mouth grammar capture.','Front-surface clearance checks do not certify arm-arm contacts or linguistic correctness.','Text sequences retain Russian source order; no grammatical translation.'],'source':f'{chart_count} chart-authored letters; {captured_count} video-timed clips including {teacher_count} VOG whole-phrase references; other clips retain per-entry provenance','qualityGate':{'minPoseCoverage':.85,'minDominantHandCoverage':.65,'maxHingeOffAxis':.0001,'motionVersion':9,'maxUpperPlaneErrorDegrees':8,'maxForearmRollDegrees':86,'maxWristSwingDegrees':66,'maxWristEnvelope':1.025,'maxWristSidewaysDegrees':25.7,'maxElbowPoleDeviationDegrees':30}}
report['chartAuthoredLetters']=chart_count
report['videoTimedClips']=captured_count
report['teacherReferences']=teacher_count
report['observed']={'maxHingeOffAxis':max(e.get('maxHingeOffAxis',0) for e in entries),'maxJointStepDegrees':max(e['maxJointStepDegrees'] for e in entries),'v9Clips':sum(e.get('motionVersion')==9 for e in entries),'maxSourceWristFitErrorMeters':max(e.get('sourceWristFitErrorMeters',0) for e in entries),'maxBodyOverlapAfterMeters':max(e.get('bodyClearance',{}).get('afterMaxMeters',0) for e in entries),'maxBodyOverlapBeforeMeters':max(e.get('bodyClearance',{}).get('beforeMaxMeters',0) for e in entries),'maxLegacyWristDriftMeters':max(e.get('legacyWristDriftMeters',0) for e in entries)}
(OUT/'quality-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(report['total'],'motions, missing',report['missing'])

# Refresh endpoint orientations whenever an authored/captured clip is replaced.
import subprocess
subprocess.run(['node',str(ROOT/'frontend/scripts/prepare-sign-transitions.mjs')],check=True)
