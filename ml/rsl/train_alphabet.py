"""Temporal all-alphabet classifier. Train/validation/test are split by signer.
The MediaPipe detector is pretrained; this logistic classifier is fitted locally.
"""
from pathlib import Path
import json,hashlib,time,shutil
import numpy as np,cv2,mediapipe as mp
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix
ROOT=Path(__file__).resolve().parents[2];DATA=ROOT/'ml/rsl/data/alphabet';OUT=ROOT/'frontend/public/models/rsl';CACHE=DATA/'features-v1';CACHE.mkdir(exist_ok=True)
labels=list('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ')+['no_event'];rows=json.loads((DATA/'manifest.json').read_text())
def frame_features(result):
 if not result.hand_landmarks:return np.zeros(66)
 area=lambda p:(max(v.x for v in p)-min(v.x for v in p))*(max(v.y for v in p)-min(v.y for v in p))
 k=max(range(len(result.hand_landmarks)),key=lambda i:area(result.hand_landmarks[i]));pts=np.array([[p.x,p.y,p.z] for p in result.hand_world_landmarks[k]])
 scale=np.linalg.norm(pts[0]-pts[9]);im=result.hand_landmarks[k];imscale=max(np.hypot(im[0].x-im[9].x,im[0].y-im[9].y),.02)
 if scale<1e-6:return np.zeros(66)
 pts=(pts-pts[0])/scale
 # Canonical hand: mirror left hands only; preserve vertical/front/back orientation.
 flip=-1 if result.handedness[k][0].category_name=='Left' else 1;pts[:,0]*=flip
 return np.r_[pts.flatten(),im[0].x*flip,im[0].y,imscale]
def aggregate(frames):
 a=np.array(frames,dtype=float);valid=a[:,65]>0
 if valid.any():
  # Fill short detection gaps for shape; visibility remains an explicit feature.
  for c in range(66):a[:,c]=np.interp(np.arange(len(a)),np.flatnonzero(valid),a[valid,c])
  wrist=a[:,63:65].copy();a[:,63:65]=(wrist-wrist[valid][0])/max(np.median(a[valid,65]),.02)
 else:a[:]=0
 a[:,65]=valid.astype(float)
 b=np.array([a[i*4:(i+1)*4].mean(0) for i in range(4)])
 pts=a[:,:63].reshape(16,21,3)
 distances=np.array([np.linalg.norm(pts[:,i]-pts[:,j],axis=1).mean() for i in range(21) for j in range(i+1,21)])
 return np.r_[b.flatten(),distances]
opts=mp.tasks.vision.HandLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(OUT/'hand_landmarker.task')),num_hands=2,min_hand_detection_confidence=.5)
samples=[]
with mp.tasks.vision.HandLandmarker.create_from_options(opts) as detector:
 for idx,r in enumerate(rows):
  cached=CACHE/(r['attachment_id']+'.json');path=DATA/(r['attachment_id']+'.mp4')
  if cached.exists():frames=json.loads(cached.read_text())
  else:
   deadline=time.monotonic()+900
   while not path.exists():
    if time.monotonic()>deadline:raise RuntimeError('Video download missing: '+path.name)
    time.sleep(2)
   cap=cv2.VideoCapture(str(path));total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));frames=[]
   for f in np.linspace(0,max(0,total-1),16).astype(int):
    cap.set(cv2.CAP_PROP_POS_FRAMES,int(f));ok,img=cap.read()
    if not ok:frames.append(np.zeros(66).tolist());continue
    h,w=img.shape[:2];factor=min(1,640/max(h,w));img=cv2.resize(img,(max(1,int(w*factor)),max(1,int(h*factor))))
    result=detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(img,cv2.COLOR_BGR2RGB)));frames.append(frame_features(result).tolist())
   cap.release();cached.write_text(json.dumps(frames))
  samples.append(dict(r,features=aggregate(frames),visibility=sum(f[65]>0 for f in frames)/16))
  if idx%25==0:print('EXTRACT',idx+1,len(rows),flush=True)
train=[r for r in samples if r['train']=='True'];test=[r for r in samples if r['train']=='False']
trainusers={r['user_id'] for r in train};testusers={r['user_id'] for r in test};assert not trainusers & testusers
valusers={u for u in trainusers if int(hashlib.sha256(u.encode()).hexdigest()[:8],16)%5==0}
fit=[r for r in train if r['user_id'] not in valusers];val=[r for r in train if r['user_id'] in valusers]
def matrices(rows):return np.array([r['features'] for r in rows]),np.array([labels.index(r['text']) for r in rows])
x,y=matrices(fit);vx,vy=matrices(val);mean=x.mean(0);std=np.maximum(x.std(0),.05);scores=[]
for c in [.1,1,10]:
 m=LogisticRegression(C=c,max_iter=2000,class_weight='balanced').fit((x-mean)/std,y);score=float((m.predict((vx-mean)/std)==vy).mean());scores.append((score,c));print('VALIDATION',c,score,flush=True)
_,best=max(scores);x,y=matrices(train);mean=x.mean(0);std=np.maximum(x.std(0),.05)
m=LogisticRegression(C=best,max_iter=2000,class_weight='balanced').fit((x-mean)/std,y)
tx,ty=matrices(test);probs=m.predict_proba((tx-mean)/std);pred=probs.argmax(1);ranked=np.sort(probs,axis=1);accepted=(ranked[:,-1]>=.70)&((ranked[:,-1]-ranked[:,-2])>=.20)&(pred!=33)&(np.array([r["visibility"] for r in test])>=.5)
report={'dataset':'Bukva: 33 letters + no_event','labels':labels,'trainVideos':len(train),'testVideos':len(test),'validationVideos':len(val),'trainSigners':len(trainusers),'testSigners':len(testusers),'signerOverlap':0,'validationC':best,'validationScores':scores,'accuracy':float((pred==ty).mean()),'acceptedAccuracy':float((pred[accepted]==ty[accepted]).mean()) if accepted.any() else None,'acceptedCoverage':float(accepted.mean()),'confusionMatrix':confusion_matrix(ty,pred,labels=list(range(34))).tolist(),'perClass':[{'label':l,'tested':int((ty==i).sum()),'correct':int(((ty==i)&(pred==i)).sum())} for i,l in enumerate(labels)],'limitations':['Isolated letters only; not continuous fingerspelling, words or grammar.','Pretrained MediaPipe plus locally trained temporal logistic classifier.','16 sampled frames; only one dominant hand, no face or body.','Subset metrics are not live-camera or pedagogical accuracy.','Unknown words can be confused with letters; confidence is not proof of correctness.'],'source':'https://github.com/ai-forever/bukva'}
model={'version':2,'kind':'temporal-alphabet','labels':labels,'mean':mean.tolist(),'std':std.tolist(),'weights':m.coef_.tolist(),'bias':m.intercept_.tolist(),'threshold':.70,'margin':.20,'frames':16,'source':report['source']}
(OUT/'alphabet-classifier.json').write_text(json.dumps(model,ensure_ascii=False));(OUT/'alphabet-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
fixture_indices=[next(i for i,r in enumerate(test) if r['text']==label) for label in ['А','Д','Ж','Й','Я','no_event']]
fixtures=[{'label':test[i]['text'],'frames':json.loads((CACHE/(test[i]['attachment_id']+'.json')).read_text()),'features':test[i]['features'].tolist(),'probabilities':probs[i].tolist()} for i in fixture_indices];(OUT/'alphabet-fixtures.json').write_text(json.dumps(fixtures))
# Every letter gets a real, traceable reference, independent of whether a 3D clip exists.
refs=[];dest=ROOT/'frontend/public/research/rsl/alphabet';dest.mkdir(exist_ok=True)
for label in labels[:-1]:
 candidates=[r for r in train if r['text']==label];r=max(candidates,key=lambda r:r['visibility']);name=f'{ord(label):04x}.mp4';shutil.copyfile(DATA/(r['attachment_id']+'.mp4'),dest/name);refs.append({'letter':label,'file':name,'attachment_id':r['attachment_id'],'visibility':r['visibility']})
(dest/'sources.json').write_text(json.dumps(refs,ensure_ascii=False,indent=2))
print('TRAINING_COMPLETE',json.dumps({k:v for k,v in report.items() if k not in ['confusionMatrix','perClass','limitations']},ensure_ascii=False),flush=True)
