"""Retarget three human phrase references, retaining external source attribution.
The source movies/crops stay in ignored research storage, never in public assets.
Download the identified public videos into RUN/teacher-reference before running.
"""
from pathlib import Path
import os,json,subprocess,tempfile,shutil,cv2
ROOT=Path(__file__).resolve().parents[2];RUN=ROOT/'ml/rsl/data/video-library-v1'
os.environ.update(MOTION_CAPTURE_DIR=str(RUN/'teacher-capture'),MOTION_CAPTURE_FPS='30',MOTION_CAPTURE_SIZE='1280')
import capture_motion
PUBLIC=ROOT/'frontend/public';BLENDER='/Applications/Blender.app/Contents/MacOS/Blender'
rows=json.loads((ROOT/'ml/rsl/teacher-references.json').read_text())
for row in rows:
 id=row['captureId'];folder=RUN/'teacher-candidates'/id;folder.mkdir(parents=True,exist_ok=True)
 source=RUN/'teacher-reference'/(row['youtube']+'.mp4');crop=folder/'source-crop.mp4'
 cap=cv2.VideoCapture(str(source));fps=cap.get(cv2.CAP_PROP_FPS)
 if not fps:raise RuntimeError('Missing source movie: '+str(source))
 width=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH));height=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
 writer=cv2.VideoWriter(str(crop),cv2.VideoWriter_fourcc(*'mp4v'),fps,(width,height))
 first=round(row['start']*fps);last=round(row['end']*fps);cap.set(cv2.CAP_PROP_POS_FRAMES,first)
 for _ in range(first,last):
  ok,img=cap.read()
  if not ok:raise RuntimeError('Incomplete teacher recording')
  writer.write(img)
 writer.release();cap.release()
 source_url=f"https://www.youtube.com/watch?v={row['youtube']}&t={int(row['start'])}s"
 entry={'id':id,'label':row['label'],'category':'Фразы','video':'/source-crop.mp4','source':source_url,'dataset':'VOG / Давайте знакомиться (2015)'}
 cache=capture_motion.OUT/(id+'.json')
 if cache.exists():cache.unlink()
 with tempfile.TemporaryDirectory(prefix='mentor-teacher-capture-') as directory:
  temp=Path(directory);(temp/'models/rsl').mkdir(parents=True)
  (temp/'models/rsl/hand_landmarker.task').symlink_to(PUBLIC/'models/rsl/hand_landmarker.task');(temp/'source-crop.mp4').symlink_to(crop)
  capture_motion.PUBLIC=temp;print(capture_motion.capture(entry),flush=True)
 captured=json.loads(cache.read_text());captured['entry'].update(video=source_url);cache.write_text(json.dumps(captured,ensure_ascii=False))
 env=dict(os.environ,MOTION_OUTPUT_DIR=str(folder))
 with (folder/'build.log').open('w') as log:
  def blender(script,*args):subprocess.run([BLENDER,'-b','--python-exit-code','1','--python',str(ROOT/'art/sign-motion'/script),'--',*args],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
  blender('retarget.py',id)
  metadata=folder/(id+'.json');assert metadata.exists()
  (folder/'catalog.json').write_text(json.dumps([json.loads(metadata.read_text())]))
  for name in ['ready-idle.glb','ready-idle.json']:shutil.copy2(PUBLIC/'avatars/sign-motion'/name,folder/name)
  blender('clear_body.py','input='+str(folder),id)
  assert json.loads(metadata.read_text())['motionVersion']==7
  blender('bake_arm_anatomy.py','input='+str(folder),'anchor='+str(ROOT/'art/sign-motion/retarget-rest-anchor.glb'),id)
  blender('verify_body_clearance.py','directory='+str(folder),id,'anatomy','report='+str(folder/'verification.json'))
  meta=json.loads(metadata.read_text());meta['sourceRecording']={'url':source_url,'startSeconds':row['start'],'endSeconds':row['end'],'title':'Давайте знакомиться!','organization':'ВОГ / Центр образования глухих и жестового языка им. Г. Л. Зайцевой','index':'https://voginfo.ru/zhestovyj-jazyk/obuchajushhie-videomaterialy/'};metadata.write_text(json.dumps(meta,ensure_ascii=False,indent=2))
 print('TEACHER_CANDIDATE',row['id'],flush=True)
