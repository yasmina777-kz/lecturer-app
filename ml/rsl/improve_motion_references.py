"""Replace hard-to-track Slovo samples with traceable alternatives from TRAIN only.
Does not select on recognition accuracy; compares landmark coverage only.
"""
from pathlib import Path
import json,csv,hashlib,math,concurrent.futures,threading,multiprocessing,shutil,cv2
from remotezip import RemoteZip
from capture_motion import capture
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'frontend/public';DATA=ROOT/'ml/rsl/data';MOTION=DATA/'motion';WORDS=PUBLIC/'research/rsl/words';local=threading.local()
URL='https://rndml-team-cv.obs.ru-moscow-1.hc.sbercloud.ru/datasets/slovo/slovo.zip'
def download(e):
 p=PUBLIC/e['video'].lstrip('/')
 if not p.exists():
  if not getattr(local,'zip',None):local.zip=RemoteZip(URL,timeout=90)
  p.write_bytes(local.zip.read('train/'+e['attachmentId']+'.mp4'))
 return e
def quality(d):
 counts={'Left':0,'Right':0}
 for f in d['frames']:
  p=f['pose']
  if not p:continue
  pairs=sorted((math.hypot(h['image'][0][0]-p[k][0],h['image'][0][1]-p[k][1]),side,i) for i,h in enumerate(f['hands']) for side,k in [('Left',15),('Right',16)])
  sides=set();used=set()
  for distance,side,i in pairs:
   if side not in sides and i not in used and distance<.24:sides.add(side);used.add(i);counts[side]+=1
 return max(counts.values())/len(d['frames']) if d['poseCoverage']>=.85 else 0
if __name__=='__main__':
 catalog=json.loads((WORDS/'catalog.json').read_text());rows=list(csv.DictReader((DATA/'slovo-annotations.csv').read_text().splitlines(),delimiter='\t'));existing={p.stem for p in (PUBLIC/'avatars/sign-motion').glob('*.glb')};failed=[e for e in catalog if e['id'] not in existing];candidates=[]
 for e in failed:
  eligible=sorted([r for r in rows if r['text']==e['label'] and r['train']=='True' and r['attachment_id']!=e['attachmentId']],key=lambda r:hashlib.sha256(r['attachment_id'].encode()).hexdigest())[:3]
  for i,r in enumerate(eligible):candidates.append(dict(e,id=e['id']+'-candidate'+str(i),attachmentId=r['attachment_id'],signerId=r['user_id'],video='/research/rsl/words/'+r['attachment_id']+'.mp4',poster='/research/rsl/words/'+r['attachment_id']+'.jpg'))
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(download,candidates))
 with concurrent.futures.ProcessPoolExecutor(max_workers=3,mp_context=multiprocessing.get_context('spawn')) as pool:
  for r in pool.map(capture,candidates):print('ALTERNATIVE',r,flush=True)
 overrides={};backup=MOTION/'candidates';backup.mkdir(exist_ok=True)
 for original in failed:
  options=[json.loads((MOTION/(e['id']+'.json')).read_text()) for e in candidates if e['id'].startswith(original['id']+'-candidate')];best=max(options,key=quality);score=quality(best)
  if score>=.65:
   new=dict(best['entry'],id=original['id']);best['entry']=new;(MOTION/(original['id']+'.json')).write_text(json.dumps(best,ensure_ascii=False));catalog[catalog.index(original)]=new;overrides[original['label']]={'attachmentId':new['attachmentId'],'stableId':new['id']}
   cap=cv2.VideoCapture(str(PUBLIC/new['video'].lstrip('/')));cap.set(cv2.CAP_PROP_POS_FRAMES,int(cap.get(cv2.CAP_PROP_FRAME_COUNT)*.5));ok,img=cap.read();cap.release()
   if ok:
    h,w=img.shape[:2];scale=min(1,480/max(w,h));cv2.imwrite(str(PUBLIC/new['poster'].lstrip('/')),cv2.resize(img,(round(w*scale),round(h*scale))))
  print('SELECTED',original['label'],score,flush=True)
 for e in candidates:shutil.move(str(MOTION/(e['id']+'.json')),str(backup/(e['id']+'.json')))
 (WORDS/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2));(ROOT/'ml/rsl/reference-overrides.json').write_text(json.dumps(overrides,ensure_ascii=False,indent=2))
