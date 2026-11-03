"""Rebuild long return-to-rest tails. Preserve the complete recorded sign interval.
All candidates require independent exported-skin verification before publishing.
"""
from pathlib import Path
import bpy,json,math,sys,os,hashlib
from mathutils import Vector as V,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path(os.environ.get('MOTION_INPUT_DIR',str(ROOT/'frontend/public/avatars/sign-motion')))
OUT=Path(os.environ['MOTION_OUTPUT_DIR']);OUT.mkdir(parents=True,exist_ok=True)
ids=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/hand-rig/Mira-Hand-Workshop.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig['controls_enabled']=0
bones=[b for b in rig.pose.bones if b.name.startswith('mixamorig:')]
for b in bones:
 for c in list(b.constraints):b.constraints.remove(c)
B=lambda name:rig.pose.bones['mixamorig:'+name]
sc=bpy.context.scene;sc.render.fps=30

def put(b,head,q):
 m=q.to_matrix().to_4x4();m.translation=head;b.matrix=m;bpy.context.view_layer.update()
exec((ROOT/'art/sign-motion/arm_anatomy.py').read_text())
exec((ROOT/'art/sign-motion/trajectory.py').read_text())
exec((ROOT/'art/sign-motion/body_clearance.py').read_text());clearance=BodyClearance(rig)
def pose(row):
 for b in bones:b.rotation_quaternion=row[b.name][0];b.location=row[b.name][1]
 bpy.context.view_layer.update()
def capture():return {b.name:(b.rotation_quaternion.copy(),b.location.copy()) for b in bones}
for id in ids:
 e=json.loads((SOURCE/(id+'.json')).read_text());rig.animation_data_clear()
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(SOURCE/(id+'.glb')));added=set(bpy.data.objects)-before
 src=next(o for o in added if o.type=='ARMATURE');rig.animation_data_create();rig.animation_data.action=src.animation_data.action;rig.animation_data.action_slot=src.animation_data.action_slot
 start,end=rig.animation_data.action.frame_range
 # Round up: never replace a frame within the recorded sign.
 seam=math.ceil((e['duration']-e['leadOut'])*30);prefix=[]
 for i in range(seam+1):sc.frame_set(int(start)+i);prefix.append(capture())
 sc.frame_set(int(end));rest=capture();a=prefix[-1]
 rig.animation_data_clear()
 for ob in added:bpy.data.objects.remove(ob,do_unlink=True)
 rolls={}
 for tag,row in [('a',a),('b',rest)]:
  pose(row);rolls[tag]={side:math.radians(arm_anatomy(side)['forearmRollDegrees']) for side in ['Left','Right']}
 rows=[]
 for i in range(46):
  t=i/45;w=t*t*t*(t*(t*6-15)+10)
  row={name:(q.slerp(rest[name][0],w),loc.lerp(rest[name][1],w)) for name,(q,loc) in a.items()}
  if i in [0,45]:rows.append(a if i==0 else rest);continue
  depth=0
  for attempt in range(10):
   pose(row)
   for side in ['Left','Right']:
    hint=rolls['a'][side]*(1-w)+rolls['b'][side]*w
    arm_anatomy(side,True,hint,depth)
   deficit=max(v['deficit'] for v in clearance.inspect(margin=.006,stride=2).values())
   if deficit<.0005:break
   depth+=deficit*1.1+.003
  rows.append(capture())
 rotations=[{name:q.copy() for name,(q,loc) in row.items()} for row in rows]
 for arow,brow in zip(rotations,rotations[1:]):
  for name,q in brow.items():
   if arow[name].dot(q)<0:q.negate()
 times=coordinated_times(rotations)
 # Do not publish a change that made release slower.
 if times[-1]>=e['leadOut']-.3:
  print('SKIPPED',id,round(times[-1],2),flush=True);continue
 samples=[(i/30,row) for i,row in enumerate(prefix[:-1])]+[(seam/30+t,row) for t,row in zip(times,rows)]
 previous={}
 for t,row in samples:
  pose(row)
  for b in bones:
   if b.name in previous and previous[b.name].dot(b.rotation_quaternion)<0:b.rotation_quaternion.negate()
   previous[b.name]=b.rotation_quaternion.copy()
   for prop in ['rotation_quaternion','location','scale']:b.keyframe_insert(prop,frame=1+t*30,group=b.name)
 sc.frame_start=1;sc.frame_end=math.ceil(samples[-1][0]*30)+1
 for b in bones:
  for prop in ['rotation_quaternion','location','scale']:b.keyframe_insert(prop,frame=sc.frame_end,group=b.name)
 for fc in rig.animation_data.action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
 rig.animation_data.action.name=id
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'.glb')),export_format='GLB',use_selection=True,export_def_bones=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True)
 old=e['duration'];new=(sc.frame_end-1)/30;cut=seam/30
 def remap(t):return t if t<=cut else cut+(new-cut)*(t-cut)/(old-cut)
 if e.get('sourceTimeline'):e['sourceTimeline']=[[round(remap(t),6),v] for t,v in e['sourceTimeline']]
 e['duration']=new;e['leadOut']=new-(old-e['leadOut']);e['releasePolish']={'oldDuration':old,'newDuration':new,'unchangedThroughSeconds':cut,'method':'quintic return, anatomical arm solve, front-surface clearance and coordinated speed limit'}
 e['bodyClearance']['sourceFrameTimes']=[round(remap(t),6) for t in e['bodyClearance']['sourceFrameTimes']]
 e['revision']=hashlib.sha256((OUT/(id+'.glb')).read_bytes()).hexdigest()[:12]
 (OUT/(id+'.json')).write_text(json.dumps(e,ensure_ascii=False,indent=2))
 print('RELEASE',id,round(old,2),'->',round(new,2),flush=True)
