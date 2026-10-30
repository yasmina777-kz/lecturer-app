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

import concurrent.futures,multiprocessing,os
DETECTOR=None
def init():
 global DETECTOR
 cv2.setNumThreads(1)
 opts=mp.tasks.vision.HandLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(OUT/'hand_landmarker.task')),num_hands=2,min_hand_detection_confidence=.5)
 DETECTOR=mp.tasks.vision.HandLandmarker.create_from_options(opts)
def process(r):
 cached=CACHE/(r['attachment_id']+'.json');path=DATA/(r['attachment_id']+'.mp4')
 if cached.exists():return
 deadline=time.monotonic()+900
 while not path.exists():
  if time.monotonic()>deadline:raise RuntimeError('Missing download: '+path.name)
  time.sleep(2)
 cap=cv2.VideoCapture(str(path));total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));indices=np.linspace(0,max(0,total-1),16).astype(int);frames=[];index=0;target=0
 while target<16:
  ok,img=cap.read()
  if not ok:break
  if index==indices[target]:
   h,w=img.shape[:2];factor=min(1,640/max(h,w));img=cv2.resize(img,(max(1,int(w*factor)),max(1,int(h*factor))))
   result=DETECTOR.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(img,cv2.COLOR_BGR2RGB)));f=frame_features(result).tolist()
   while target<16 and indices[target]==index:frames.append(f);target+=1
  index+=1
 cap.release()
 while len(frames)<16:frames.append(np.zeros(66).tolist())
 temp=cached.with_suffix('.tmp');temp.write_text(json.dumps(frames));temp.replace(cached)
if __name__=='__main__':
 with concurrent.futures.ProcessPoolExecutor(max_workers=4,mp_context=multiprocessing.get_context('spawn'),initializer=init) as pool:
  for i,_ in enumerate(pool.map(process,rows)):
   if i%50==0:print('EXTRACT',i+1,len(rows),flush=True)
 print('EXTRACTION_COMPLETE',flush=True)
