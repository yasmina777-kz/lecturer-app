"""Select clearer TRAIN-only observations, keeping failed candidates private.
This is observation-quality selection, never a claim of RSL semantic validation.
"""
from pathlib import Path
import json,csv,hashlib,sys,cv2
from remotezip import RemoteZip
import capture_motion
from tracking_quality import tracking_quality
ROOT=Path(__file__).resolve().parents[2];RUN=ROOT/'ml/rsl/data/video-library-v1';ALT=RUN/'alternatives-build';ALT.mkdir(exist_ok=True);(ALT/'capture').mkdir(exist_ok=True)
PUBLIC=RUN/'source-public';(PUBLIC/'models/rsl').mkdir(parents=True,exist_ok=True)
model=PUBLIC/'models/rsl/hand_landmarker.task'
if not model.exists():model.symlink_to(ROOT/'frontend/public/models/rsl/hand_landmarker.task')
capture_motion.PUBLIC=PUBLIC;capture_motion.OUT=RUN/'alternative-capture';capture_motion.OUT.mkdir(exist_ok=True)
catalog=json.loads((ROOT/'frontend/public/research/rsl/words/catalog.json').read_text());annotations=list(csv.DictReader((ROOT/'ml/rsl/data/slovo-annotations.csv').read_text().splitlines(),delimiter='\t'))
selected=json.loads((ALT/'selected.json').read_text()) if (ALT/'selected.json').exists() else []
report=json.loads((ALT/'selection-report.json').read_text()) if (ALT/'selection-report.json').exists() else []
ids=set(sys.argv[1:]);already={r['id'] for r in report}
# These clips have source-specific authored paths: changing their recording
# requires a separate manual review of those overrides.
fixed={'word-0cca1e04','word-8c1a7f26','word-a8989f04','word-542b93a5','word-f1a5226d','word-9fcf26f7','word-f17a6060'}
with RemoteZip('https://rndml-team-cv.obs.ru-moscow-1.hc.sbercloud.ru/datasets/slovo/slovo.zip',timeout=90) as archive:
 for entry in catalog:
  if ids and entry['id'] not in ids:continue
  if entry['id'] in already:continue
  cached=RUN/'capture'/(entry['id']+'.json')
  if not cached.exists() or entry['id'] in fixed:continue
  original=json.loads(cached.read_text());quality=tracking_quality(original)
  if not quality['flags']:continue
  options=sorted([r for r in annotations if r['text']==entry['label'] and r['train']=='True' and r['attachment_id']!=entry['attachmentId']],key=lambda r:hashlib.sha256(r['attachment_id'].encode()).hexdigest())[:5]
  best=original;best_quality=quality;trials=[]
  for row in options:
   attachment=row['attachment_id'];video='/research/rsl/words/'+attachment+'.mp4';path=PUBLIC/video.lstrip('/');path.parent.mkdir(parents=True,exist_ok=True)
   if not path.exists():path.write_bytes(archive.read('train/'+attachment+'.mp4'))
   candidate=dict(entry,id=entry['id']+'-alt-'+attachment[:8],video=video,poster=video[:-4]+'.jpg',attachmentId=attachment,signerId=row['user_id'])
   capture_motion.capture(candidate);data=json.loads((capture_motion.OUT/(candidate['id']+'.json')).read_text());q=tracking_quality(data);trials.append({'attachmentId':attachment,**q})
   if q['score']>best_quality['score']:best=data;best_quality=q
   if not q['flags'] and q['score']>=.94:break
  improved=best is not original and not best_quality['flags']
  report.append({'id':entry['id'],'label':entry['label'],'before':quality,'after':best_quality,'selected':improved,'candidates':trials})
  if improved:
   best['entry']['id']=entry['id'];selected.append(best['entry']);(ALT/'capture'/(entry['id']+'.json')).write_text(json.dumps(best,ensure_ascii=False))
  (ALT/'selected.json').write_text(json.dumps(selected,ensure_ascii=False,indent=2));(ALT/'selection-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('REFERENCE',entry['label'],quality['score'],'->',best_quality['score'],'selected',improved,flush=True)
