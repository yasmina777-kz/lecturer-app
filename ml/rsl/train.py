"""Fit an independent small RSL classifier; MediaPipe is only the pretrained hand detector.
No API calls, no SignStart code. Official subject-disjoint Bukva split is preserved.
"""
from pathlib import Path
import json,collections
import numpy as np,cv2,mediapipe as mp
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score,confusion_matrix
ROOT=Path(__file__).resolve().parents[2]; HERE=Path(__file__).resolve().parent; DATA=HERE/'data'; OUT=ROOT/'frontend/public/models/rsl'
rows=json.loads((DATA/'manifest.json').read_text()); labels=['А','В','Л']

def features(points):
 p=np.array(points); scale=np.linalg.norm(p[0]-p[9])
 if scale<1e-6:return None
 return np.array([np.linalg.norm(p[a]-p[b])/scale for a in range(21) for b in range(a+1,21)])
cache=DATA/'features.json'
if cache.exists():samples=json.loads(cache.read_text())
else:
 samples=[]
 opts=mp.tasks.vision.HandLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(OUT/'hand_landmarker.task')),num_hands=2,min_hand_detection_confidence=.5)
 with mp.tasks.vision.HandLandmarker.create_from_options(opts) as detector:
  for idx,r in enumerate(rows):
   cap=cv2.VideoCapture(str(DATA/(r['attachment_id']+'.mp4')));total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));found=[]
   for frame in np.linspace(.30*total,.70*total,5).astype(int):
    cap.set(cv2.CAP_PROP_POS_FRAMES,int(frame));ok,img=cap.read()
    if not ok:continue
    h,w=img.shape[:2];img=cv2.resize(img,(int(w*min(1,720/max(h,w))),int(h*min(1,720/max(h,w)))))
    result=detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(img,cv2.COLOR_BGR2RGB)))
    if not result.hand_landmarks:continue
    # Largest hand in the image: avoid a small resting hand becoming the label.
    area=lambda hand:(max(p.x for p in hand)-min(p.x for p in hand))*(max(p.y for p in hand)-min(p.y for p in hand))
    k=max(range(len(result.hand_landmarks)),key=lambda k:area(result.hand_landmarks[k]));f=features([[p.x,p.y,p.z] for p in result.hand_world_landmarks[k]])
    if f is not None:found.append(f.tolist())
   cap.release();samples.append(dict(r,features=found));print(idx+1,len(rows),'frames',len(found),flush=True)
 cache.write_text(json.dumps(samples))
train_users={r['user_id'] for r in samples if r['train']=='True'}; test_users={r['user_id'] for r in samples if r['train']=='False'}
assert not train_users & test_users,'Subject leakage'
train=[(f,labels.index(r['text'])) for r in samples if r['train']=='True' for f in r['features']]
x=np.array([f for f,y in train]);y=np.array([y for f,y in train]);mean=x.mean(0);std=np.maximum(x.std(0),.05);z=(x-mean)/std
model=LogisticRegression(C=.1,max_iter=2000,class_weight='balanced').fit(z,y)
truth=[];pred=[];accepted=[];video_results=[]
for r in samples:
 if r['train']!='False':continue
 actual=labels.index(r['text']);truth.append(actual)
 if not r['features']:pred.append(-1);video_results.append({'id':r['attachment_id'],'expected':r['text'],'prediction':None});continue
 probs=model.predict_proba((np.array(r['features'])-mean)/std).mean(0);guess=int(probs.argmax());pred.append(guess)
 ranked=np.sort(probs); accept=ranked[-1]>=.8 and ranked[-1]-ranked[-2]>=.25
 if accept:accepted.append(guess==actual)
 video_results.append({'id':r['attachment_id'],'expected':r['text'],'prediction':labels[guess],'confidence':float(max(probs)),'accepted':bool(accept)})
report={'dataset':'Bukva subset','labels':labels,'trainVideos':sum(r['train']=='True' for r in samples),'testVideos':len(truth),'trainFrames':len(train),'trainSigners':len(train_users),'testSigners':len(test_users),'signerOverlap':0,'missingHandVideos':sum(p==-1 for p in pred),'videoAccuracyIncludingMissingHands':sum(a==b for a,b in zip(truth,pred))/len(truth),'acceptedAccuracy':sum(accepted)/len(accepted) if accepted else None,'acceptedCoverage':len(accepted)/len(truth),'confusionMatrix':confusion_matrix(truth,pred,labels=[0,1,2,-1]).tolist(),'testResults':video_results,'limitations':['Three isolated hand shapes only, not words or phrases.','MediaPipe hand landmarks are pretrained; the logistic classifier is trained here.','Numbers are for this dataset subset, not live-user or pedagogical accuracy.','Unknown signs may still be classified as a supported letter. No correctness certification.'],'source':'https://github.com/ai-forever/bukva'}
(OUT/'training-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
export={'version':1,'labels':labels,'mean':mean.tolist(),'std':std.tolist(),'weights':model.coef_.tolist(),'bias':model.intercept_.tolist(),'threshold':.8,'margin':.25,'source':report['source']}
(OUT/'classifier.json').write_text(json.dumps(export,ensure_ascii=False))
# Fixtures for JS/Python parity, never used to fit the model.
fixtures=[]
for r in samples:
 if r['train']=='False' and r['features']:
  f=r['features'][0];fixtures.append({'features':f,'probabilities':model.predict_proba([(np.array(f)-mean)/std])[0].tolist()})
  if len(fixtures)==5:break
(OUT/'test-fixtures.json').write_text(json.dumps(fixtures))
print(json.dumps({k:v for k,v in report.items() if k!='testResults'},ensure_ascii=False,indent=2))
