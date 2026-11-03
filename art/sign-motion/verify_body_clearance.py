"""Independent checks of exported GLBs: evaluated skin clearance and arm articulation.
Samples half-frames (60 Hz), including lead-in/out. No solver corrections here.
"""
from pathlib import Path
import bpy,json,sys,time,math,hashlib
from mathutils import Vector as V,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'frontend/public/avatars/sign-motion'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/hand-rig/Mira-Hand-Workshop.blend'));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig['controls_enabled']=0;sc=bpy.context.scene;sc.render.fps=30
exec(compile((ROOT/'art/sign-motion/body_clearance.py').read_text(),'body_clearance.py','exec'),globals())
B=lambda name:rig.pose.bones['mixamorig:'+name]
exec((ROOT/'art/sign-motion/arm_anatomy.py').read_text())
clearance=BodyClearance(rig);args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
custom=next((x for x in args if x.startswith('directory=')),None);base=Path(custom.split('=',1)[1]) if custom else OUT
files=sorted(base.glob('word-*.glb'))+sorted(base.glob('letter-*.glb'))+sorted(base.glob('prepared-*.glb'))+sorted(base.glob('ready-idle.glb'))+sorted(base.glob('phrase-*.glb'))
ids=[x for x in args if x!='anatomy' and not x.startswith(('directory=','batch=','report='))]
if ids:files=[p for p in files if p.stem in ids]
batch=next((x for x in args if x.startswith('batch=')),None)
if batch:
 index,total=map(int,batch.split('=')[1].split('/'));files=[p for i,p in enumerate(files) if i%total==index]
report={'method':'evaluated hand/forearm skin versus torso, head and clothing front surfaces; sampled at 60 Hz','sampleRate':60,'toleranceMeters':.002,'clips':[]};started=time.time()
for file in files:
 revision=hashlib.sha256(file.read_bytes()).hexdigest();before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(file));added=set(bpy.data.objects)-before;src=next(o for o in added if o.type=='ARMATURE');rig.animation_data.action=src.animation_data.action;rig.animation_data.action_slot=src.animation_data.action_slot
 for fc in rig.animation_data.action.fcurves:
  if 'pose.bones["mixamorig' in fc.data_path and 'pose.bones["mixamorig:' not in fc.data_path:fc.data_path=fc.data_path.replace('pose.bones["mixamorig','pose.bones["mixamorig:')
 start,end=rig.animation_data.action.frame_range;maximum=0;worst=None;samples=0;arm_limits={'elbowPoleDeviationDegrees':0,'upperPlaneErrorDegrees':0,'forearmRollDegrees':0,'wristSwingDegrees':0,'wristFlexionDegrees':0,'wristDeviationDegrees':0,'wristEnvelope':0}
 for i in range(math.ceil((end-start)*2)+1):
  frame=min(end,start+i*.5);sc.frame_set(math.floor(frame),subframe=frame%1);values=clearance.inspect(margin=0,stride=1);samples+=1
  if 'anatomy' in args:
   for side in ['Left','Right']:
    for key,value in arm_anatomy(side).items():arm_limits[key]=max(arm_limits[key],abs(value))
  for side,row in values.items():
   if row['deficit']>maximum:maximum=row['deficit'];worst={'frame':frame,'side':side,'point':row['point']}
 result={'id':file.stem,'sha256':revision,'maxOverlapMeters':maximum,'samples':samples,'worst':worst,'armAnatomy':arm_limits};report['clips'].append(result)
 print('VERIFIED',file.stem,round(maximum*1000,3),'mm',flush=True)
 for ob in added:bpy.data.objects.remove(ob,do_unlink=True)
report['seconds']=time.time()-started;report['failed']=[e['id'] for e in report['clips'] if e['maxOverlapMeters']>.002 or e['armAnatomy']['elbowPoleDeviationDegrees']>30 or e['armAnatomy']['upperPlaneErrorDegrees']>8 or e['armAnatomy']['forearmRollDegrees']>86 or e['armAnatomy']['wristSwingDegrees']>66 or e['armAnatomy']['wristEnvelope']>1.025]
output=next((x.split('=',1)[1] for x in args if x.startswith('report=')),'/tmp/body-clearance-validation.json');Path(output).write_text(json.dumps(report,ensure_ascii=False,indent=2));print('RESULT',len(report['clips']),'clips; failures',report['failed'],flush=True)
if report['failed']:raise RuntimeError('Exported motion violates clearance or arm articulation: '+', '.join(report['failed']))
