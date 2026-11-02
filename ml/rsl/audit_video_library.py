"""Compare every rebuilt candidate with the shipped library before promotion.
Visibility and geometry gates are heuristics, not a linguistic certification.
"""
from pathlib import Path
import json,hashlib
from tracking_quality import tracking_quality
ROOT=Path(__file__).resolve().parents[2];RUN=ROOT/'ml/rsl/data/video-library-v1';PUBLIC=ROOT/'frontend/public/avatars/sign-motion'
baseline=RUN/'baseline-catalog.json'
if not baseline.exists():baseline.write_text((PUBLIC/'catalog.json').read_text())
old=json.loads(baseline.read_text());records=[]
notes=json.loads((ROOT/'ml/rsl/video-review-notes.json').read_text())['reject']
for entry in old:
 id=entry['id'];folder=RUN/'candidates'/id;capture=RUN/'capture'/(id+'.json');source_kind='Bukva' if id.startswith('letter-') else 'Slovo'
 alternative=RUN/'alternatives-build/candidates'/id
 if (alternative/'status.json').exists() and json.loads((alternative/'status.json').read_text()).get('status')=='passed':folder=alternative;capture=RUN/'alternatives-build/capture'/(id+'.json')
 if id.startswith('prepared-'):
  spec=next(r for r in json.loads((ROOT/'ml/rsl/teacher-references.json').read_text()) if r['id']==id);folder=RUN/'teacher-candidates'/spec['captureId'];capture=RUN/'teacher-capture'/(spec['captureId']+'.json');source_kind='VOG';candidate_id=spec['captureId']
 else:candidate_id=id
 meta=folder/(candidate_id+'.json');verification=folder/'verification.json'
 record={'id':id,'label':entry['label'],'sourceKind':source_kind,'status':'not-built','flags':[]}
 status_file=folder/'status.json'
 if status_file.exists() and json.loads(status_file.read_text()).get('status')=='failed':
  record.update(status='needs-correction',flags=['Candidate did not pass capture or exported-geometry checks'])
 if meta.exists() and verification.exists() and capture.exists():
  new=json.loads(meta.read_text());checked=json.loads(verification.read_text());data=json.loads(capture.read_text());quality=tracking_quality(data)
  digest=hashlib.sha256((folder/(candidate_id+'.glb')).read_bytes()).hexdigest()
  valid=not checked['failed'] and len(checked['clips'])==1 and checked['clips'][0]['sha256']==digest
  flags=list(quality['flags']);error=new.get('meanFingerDirectionErrorDegrees',0)
  if new.get('reference')!=data['entry']['video']:flags.append('Motion/capture reference mismatch')
  if not valid:flags.append('Exported geometry failed or validation is stale')
  if error>25:flags.append('Finger direction fit exceeds 25 degrees')
  old_error=entry.get('meanFingerDirectionErrorDegrees')
  if old_error is not None and error>old_error+4:flags.append('Finger fit worsened versus previous capture')
  if new['duration']>entry['duration']*1.25+.3:flags.append('Playback substantially slower than previous motion')
  if new['duration']>1.4+data['frames'][-1]['t']*2.5:flags.append('Playback stretched over 2.5 times the source motion')
  if id in notes:flags.append('Visual screening: '+notes[id])
  record.update(status='candidate-ready' if not flags else 'needs-correction',flags=flags,reference=new['reference'],tracking=quality,duration=new['duration'],previousDuration=entry['duration'],fingerFitDegrees=error,sha256=digest,candidate=str(folder),candidateId=candidate_id,capture=str(capture),sourceEntry=data['entry'])
 records.append(record)
report={'scope':'All current letters, words and three whole-phrase demonstrations. Other ready phrases are sequences of saved word motions, not a grammar model.','linguisticReview':'not-reviewed','counts':{status:sum(r['status']==status for r in records) for status in ['candidate-ready','needs-correction','not-built']},'entries':records}
(RUN/'audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(report['counts'])
