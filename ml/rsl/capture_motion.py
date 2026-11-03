"""Extract motion references locally. This is pretrained tracking, not new AI training.
Keeps source identities and missing detections for explicit quality checks.
"""
import os
os.environ.setdefault('OMP_NUM_THREADS','1')
from pathlib import Path
import json,sys,concurrent.futures,multiprocessing,hashlib
from reference_store import source_path
import numpy as np,cv2,mediapipe as mp
ROOT=Path(__file__).resolve().parents[2];PUBLIC=ROOT/'frontend/public';MODELS=ROOT/'ml/rsl/data/motion';OUT=Path(os.environ.get('MOTION_CAPTURE_DIR',str(MODELS)));OUT.mkdir(parents=True,exist_ok=True)
def capture(entry):
 dest=OUT/(entry['id']+'.json')
 source=source_path(entry['video']);digest=hashlib.sha256(source.read_bytes()).hexdigest()
 if dest.exists():
  cached=json.loads(dest.read_text())
  if cached['entry']['video']==entry['video'] and cached.get('sourceSha256')==digest and cached.get('captureFps')==int(os.environ.get('MOTION_CAPTURE_FPS','20')):return entry['id'],'cached'
 cv2.setNumThreads(1)
 cap=cv2.VideoCapture(str(source));fps=cap.get(cv2.CAP_PROP_FPS);total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));duration=total/max(fps,1)
 if total<2 or not .4<duration<30:raise ValueError((entry['label'],duration))
 sample_fps=int(os.environ.get('MOTION_CAPTURE_FPS','20'))
 indices=np.unique(np.linspace(0,total-1,min(450,max(16,int(duration*sample_fps)))).astype(int));wanted=set(indices);frames=[]
 base=mp.tasks.BaseOptions;vision=mp.tasks.vision
 with vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(base_options=base(model_asset_path=str(MODELS/'pose_landmarker_full.task')),running_mode=vision.RunningMode.VIDEO)) as pose, vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(base_options=base(model_asset_path=str(PUBLIC/'models/rsl/hand_landmarker.task')),running_mode=vision.RunningMode.VIDEO,num_hands=2,min_hand_detection_confidence=.45,min_hand_presence_confidence=.45)) as hands:
  for i in range(total):
   ok,img=cap.read()
   if not ok:break
   if i not in wanted:continue
   h,w=img.shape[:2];factor=min(1,int(os.environ.get('MOTION_CAPTURE_SIZE','800'))/max(h,w));img=cv2.resize(img,(max(1,round(w*factor)),max(1,round(h*factor))))
   image=mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(img,cv2.COLOR_BGR2RGB));stamp=round(i/fps*1000)
   p=pose.detect_for_video(image,stamp);hs=hands.detect_for_video(image,stamp)
   xyz=lambda pts:[[round(v.x,6),round(v.y,6),round(v.z,6)] for v in pts]
   frames.append({'t':round(i/fps,4),'pose':xyz(p.pose_landmarks[0]) if p.pose_landmarks else None,'world':xyz(p.pose_world_landmarks[0]) if p.pose_world_landmarks else None,'hands':[{'image':xyz(im),'world':xyz(wo),'side':side[0].category_name} for im,wo,side in zip(hs.hand_landmarks,hs.hand_world_landmarks,hs.handedness)]})
 cap.release();detected=sum(bool(f['pose']) for f in frames)/len(frames)
 dest.write_text(json.dumps({'sourceSha256':digest,'entry':entry,'duration':duration,'aspect':w/h,'frames':frames,'poseCoverage':detected,'captureFps':sample_fps},ensure_ascii=False))
 return entry['id'],round(detected,3)
def entries():
 words=json.loads((PUBLIC/'research/rsl/words/catalog.json').read_text())
 letters=[{'id':f'letter-{ord(x):x}','label':x,'category':'Алфавит','video':f'/research/rsl/alphabet/{ord(x):04x}.mp4','dataset':'Bukva','source':'https://github.com/ai-forever/bukva'} for x in 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ']
 return words+letters
if __name__=='__main__':
 rows=entries();wanted=sys.argv[1:]
 if wanted:rows=[r for r in rows if r['label'] in wanted]
 with concurrent.futures.ProcessPoolExecutor(max_workers=3,mp_context=multiprocessing.get_context('spawn')) as pool:
  for i,result in enumerate(pool.map(capture,rows)):print('CAPTURE',i+1,len(rows),*result,flush=True)
