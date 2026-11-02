"""Build isolated motion candidates for the complete local reference catalog.
Does not modify public animation assets. Resume skips only hash-verified outputs.
"""
from pathlib import Path
import os,sys,json,subprocess,hashlib,time,concurrent.futures,shutil,argparse
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--workers',type=int,default=3);parser.add_argument('--ids',nargs='*');parser.add_argument('--manifest');parser.add_argument('--run-dir');args=parser.parse_args()
RUN=Path(args.run_dir) if args.run_dir else ROOT/'ml/rsl/data/video-library-v1';RUN.mkdir(parents=True,exist_ok=True)
os.environ.update(MOTION_CAPTURE_DIR=str(RUN/'capture'),MOTION_CAPTURE_FPS='30',MOTION_CAPTURE_SIZE='1280')
from capture_motion import entries
rows=json.loads(Path(args.manifest).read_text()) if args.manifest else entries()
if args.ids:rows=[e for e in rows if e['id'] in args.ids]
BLENDER='/Applications/Blender.app/Contents/MacOS/Blender';PUBLIC=ROOT/'frontend/public/avatars/sign-motion'
sources=['art/sign-motion/'+p for p in ['retarget.py','kinematics.py','hand_pose_overrides.py','trajectory.py','clear_body.py','bake_arm_anatomy.py','body_clearance.py','arm_anatomy.py','verify_body_clearance.py']]+['ml/rsl/capture_motion.py','ml/rsl/build_video_library.py']
version=hashlib.sha256(b''.join((ROOT/p).read_bytes() for p in sources)).hexdigest()
def work(entry):
 id=entry['id'];folder=RUN/'candidates'/id;folder.mkdir(parents=True,exist_ok=True);status_path=folder/'status.json'
 if status_path.exists():
  old=json.loads(status_path.read_text())
  if old.get('version')==version and old.get('status')=='passed' and hashlib.sha256((folder/(id+'.glb')).read_bytes()).hexdigest()==old['sha256']:return old
 status={'id':id,'label':entry['label'],'status':'running','version':version};status_path.write_text(json.dumps(status,ensure_ascii=False));started=time.time()
 env=dict(os.environ,MOTION_OUTPUT_DIR=str(folder))
 try:
  with (folder/'build.log').open('w') as log:
   def run(command):subprocess.run(command,cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
   if args.manifest:
    # Alternate references are already captured in the isolated staging area.
    # Never recapture by label: that would silently restore the public source.
    cached=json.loads((RUN/'capture'/(id+'.json')).read_text())
    assert cached['entry']['video']==entry['video'], 'Manifest/capture source mismatch'
   else:run([sys.executable,str(ROOT/'ml/rsl/capture_motion.py'),entry['label']])
   def blender(script,*options):run([BLENDER,'-b','--python-exit-code','1','--python',str(ROOT/'art/sign-motion'/script),'--',*options])
   metadata=folder/(id+'.json');old_stamp=metadata.stat().st_mtime_ns if metadata.exists() else None
   blender('retarget.py',id)
   if not metadata.exists() or metadata.stat().st_mtime_ns==old_stamp:raise RuntimeError('Capture coverage did not pass')
   (folder/'catalog.json').write_text(json.dumps([json.loads(metadata.read_text())]))
   for name in ['ready-idle.glb','ready-idle.json']:shutil.copy2(PUBLIC/name,folder/name)
   blender('clear_body.py','input='+str(folder),id)
   if json.loads(metadata.read_text()).get('motionVersion')!=7:raise RuntimeError('Body clearance did not pass')
   blender('bake_arm_anatomy.py','input='+str(folder),'anchor='+str(ROOT/'art/sign-motion/retarget-rest-anchor.glb'),id)
   blender('verify_body_clearance.py','directory='+str(folder),id,'anatomy','report='+str(folder/'verification.json'))
   report=json.loads((folder/'verification.json').read_text());assert not report['failed'] and len(report['clips'])==1
   status.update(status='passed',sha256=hashlib.sha256((folder/(id+'.glb')).read_bytes()).hexdigest())
 except Exception as e:status.update(status='failed',error=str(e))
 status['seconds']=round(time.time()-started,1);status_path.write_text(json.dumps(status,ensure_ascii=False,indent=2));return status
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
 futures=[pool.submit(work,e) for e in rows]
 for future in concurrent.futures.as_completed(futures):
  result=future.result();results.append(result);print(len(results),len(rows),result['status'],result['id'],result['label'],flush=True)
  (RUN/'progress.json').write_text(json.dumps({'total':len(rows),'finished':len(results),'passed':sum(r['status']=='passed' for r in results),'failed':[r for r in results if r['status']=='failed'],'results':results},ensure_ascii=False,indent=2))
print('CANDIDATES_READY',len(results),'Review before promoting to the platform',flush=True)
