"""Rebake arm hinges/pronation while retaining source finger curves."""
from pathlib import Path
import bpy,json,math,sys,time,hashlib
from mathutils import Vector as V,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'frontend/public/avatars/sign-motion'
args=sys.argv[sys.argv.index('--')+1:];INPUT=Path(next(x.split('=',1)[1] for x in args if x.startswith('input=')))
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/hand-rig/Mira-Hand-Workshop.blend'));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig['controls_enabled']=0;sc=bpy.context.scene;sc.render.fps=30
bones=[b for b in rig.pose.bones if b.name.startswith('mixamorig:')];B=lambda name:rig.pose.bones['mixamorig:'+name]
# Removing animation_data also removes the controller enable drivers. Remove
# their deform constraints first, or they silently override every baked pose.
for b in bones:
 for c in list(b.constraints):b.constraints.remove(c)
def put(b,head,q):
 m=q.to_matrix().to_4x4();m.translation=head;b.matrix=m;bpy.context.view_layer.update()
exec((ROOT/'art/sign-motion/arm_anatomy.py').read_text())
exec((ROOT/'art/sign-motion/trajectory.py').read_text())
exec((ROOT/'art/sign-motion/body_clearance.py').read_text());clearance=BodyClearance(rig)
entries=json.loads((INPUT/'catalog.json').read_text())+[json.loads((INPUT/'ready-idle.json').read_text())]
ids=[x for x in args if '=' not in x]
if ids:entries=[e for e in entries if e['id'] in ids]
batch=next((x for x in args if x.startswith('batch=')),None)
if batch:
 i,n=map(int,batch.split('=')[1].split('/'));entries=entries[i::n]
def pose(row):
 for b in bones:b.rotation_quaternion=row[b.name][0];b.location=row[b.name][1]
 bpy.context.view_layer.update()
# A single relaxed boundary pose makes arbitrary word joins safe: independent
# clip endpoints may each clear the body while their joint-space blend does not.
anchor_path=Path(next((x.split('=',1)[1] for x in args if x.startswith('anchor=')),str(INPUT/'ready-idle.glb')))
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(anchor_path));added=set(bpy.data.objects)-before;src=next(o for o in added if o.type=='ARMATURE');rig.animation_data_create();rig.animation_data.action=src.animation_data.action;rig.animation_data.action_slot=src.animation_data.action_slot
sc.frame_set(int(rig.animation_data.action.frame_range[0]));anchor={b.name:(b.rotation_quaternion.copy(),b.location.copy()) for b in bones};rig.animation_data_clear()
for ob in added:bpy.data.objects.remove(ob,do_unlink=True)
for e in entries:
 started=time.time();id=e['id'];original=json.loads((INPUT/(id+'.json')).read_text());e=original.copy();rig.animation_data_clear()
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(INPUT/(id+'.glb')));added=set(bpy.data.objects)-before;src=next(o for o in added if o.type=='ARMATURE');rig.animation_data_create();rig.animation_data.action=src.animation_data.action;rig.animation_data.action_slot=src.animation_data.action_slot
 start,end=rig.animation_data.action.frame_range;rows=[];hints=[];previous={s:None for s in ['Left','Right']};max_before=0
 for frame in range(int(start),int(end)+1):
  sc.frame_set(frame);rows.append({b.name:(b.rotation_quaternion.copy(),b.location.copy()) for b in bones});hint={}
  for side in previous:
   metrics=arm_anatomy(side,roll_hint=previous[side],solve=True);hint[side]=math.radians(metrics['forearmRollDegrees']);previous[side]=hint[side];max_before=max(max_before,arm_anatomy(side)['upperPlaneErrorDegrees'])
  hints.append(hint)
 rig.animation_data_clear()
 for ob in added:bpy.data.objects.remove(ob,do_unlink=True)
 # Change only the preparation/release, leaving meaningful sign frames intact.
 # Each clip begins and ends at exactly the same complete skeleton pose.
 ramp=min(.5,e['leadIn']*.8,e['leadOut']*.8)
 for i,row in enumerate(rows):
  edge=min(i,len(rows)-1-i)/30
  if edge<ramp:
   t=edge/ramp;weight=t*t*t*(t*(t*6-15)+10)
   rows[i]={name:(anchor[name][0].slerp(q,weight),anchor[name][1].lerp(loc,weight)) for name,(q,loc) in row.items()}
 hints=[];previous={s:None for s in ['Left','Right']}
 for i,row in enumerate(rows):
  pose(row);hint={}
  for side in previous:
   hint[side]=math.radians(arm_anatomy(side,roll_hint=previous[side] if i not in [0,len(rows)-1] else None,solve=True)['forearmRollDegrees']);previous[side]=hint[side]
  hints.append(hint)
 shifts=[]
 for row,hint in zip(rows,hints):
  depth=0
  for iteration in range(8):
   pose(row)
   for side in previous:arm_anatomy(side,True,hint[side],depth)
   deficit=max(v['deficit'] for v in clearance.inspect(margin=.005,stride=2).values())
   if deficit<.0005:break
   depth+=deficit*1.1+.003
  shifts.append(depth)
 raw_shifts=shifts[:]
 count=len(rows);shifts=[max(shifts[j]*math.exp(-((i-j)/6)**2) for j in range(max(0,i-16),min(count,i+17))) for i in range(count)]
 for i in range(count):
  t=min(1,min(i,count-1-i)/max(1,ramp*30));shifts[i]=max(raw_shifts[i],shifts[i]*t*t*(3-2*t))
 corrected=[];locations=[];max_after=0;worst_body=0
 for row,hint,depth in zip(rows,hints,shifts):
  pose(row)
  for side in previous:arm_anatomy(side,True,hint[side],depth)
  corrected.append({b.name:b.rotation_quaternion.copy() for b in bones});locations.append({b.name:b.location.copy() for b in bones})
  worst_body=max(worst_body,max(v['deficit'] for v in clearance.inspect(margin=0,stride=1).values()))
  for side in previous:max_after=max(max_after,arm_anatomy(side)['upperPlaneErrorDegrees'])
 if worst_body>.002:raise RuntimeError(f'{id}: body overlap {worst_body}')
 for a,b in zip(corrected,corrected[1:]):
  for name,q in b.items():
   if a[name].dot(q)<0:q.negate()
 times=coordinated_times(corrected)
 for i,row in enumerate(corrected):
  for b in bones:
   b.rotation_quaternion=row[b.name];b.location=locations[i][b.name]
   for prop in ['rotation_quaternion','location','scale']:b.keyframe_insert(prop,frame=1+times[i]*30,group=b.name)
 sc.frame_start=1;sc.frame_end=math.ceil(times[-1]*30)+1
 for b in bones:
  for prop in ['rotation_quaternion','location','scale']:b.keyframe_insert(prop,frame=sc.frame_end,group=b.name)
 rig.animation_data.action.name=id
 for fc in rig.animation_data.action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
 peak=0;previous_q={}
 for frame in range(1,sc.frame_end+1):
  sc.frame_set(frame)
  for b in bones:
   q=b.rotation_quaternion.normalized()
   if b.name in previous_q:peak=max(peak,math.degrees(previous_q[b.name].rotation_difference(q).angle))
   previous_q[b.name]=q.copy()
 e['maxJointStepDegrees']=peak
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'.glb')),export_format='GLB',use_selection=True,export_def_bones=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True)
 def remap(t):
  f=min(t*30,len(times)-1);i=int(f);return times[i]+(times[min(i+1,len(times)-1)]-times[i])*(f-i)
 if e.get('sourceTimeline'):e['sourceTimeline']=[[round(remap(t),6),source] for t,source in e['sourceTimeline']]
 old_duration=e['duration'];e['duration']=(sc.frame_end-1)/30;e['leadIn']=remap(e['leadIn']);e['leadOut']=e['duration']-remap(old_duration-e['leadOut'])
 e['bodyClearance']['sourceFrameTimes']=[round(remap(t),6) for t in e['bodyClearance']['sourceFrameTimes']];e['bodyClearance']['afterMaxMeters']=worst_body
 e['armAnatomy']={'method':'hinge-aligned upper arm, forearm pronation +/-85 degrees, wrist swing <=65 degrees','beforeUpperPlaneErrorDegrees':max_before,'afterUpperPlaneErrorDegrees':max_after,'extraDepthMeters':max(shifts)};e['motionVersion']=8;e['revision']=hashlib.sha256((OUT/(id+'.glb')).read_bytes()).hexdigest()[:12];e.pop('transitionPose',None)
 (OUT/(id+'.json')).write_text(json.dumps(e,ensure_ascii=False,indent=2));print('ANATOMY',id,e['label'],round(time.time()-started,1),flush=True)
