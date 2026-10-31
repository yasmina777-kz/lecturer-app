"""Project captured/authored sign paths out of the evaluated body and shirt.
Run after retarget.py/repair_prepared.py, before publish_motion_catalog.py.
"""
from pathlib import Path
import sys,json,math,time
ROOT=Path(__file__).resolve().parents[2];source=ROOT/'art/sign-motion/retarget.py';__file__=str(source)
exec(compile(source.read_text().split('manifest=[]')[0],str(source),'exec'),globals())
exec(compile((ROOT/'art/sign-motion/body_clearance.py').read_text(),'body_clearance.py','exec'),globals())
repair_hand_weights(rig);clearance=BodyClearance(rig)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
input_arg=next((x for x in args if x.startswith('input=')),None);INPUT=Path(input_arg.split('=',1)[1]) if input_arg else OUT
refine_input='refine' in args
ids=[x for x in args if x!='refine' and not x.startswith(('input=','batch='))];catalog=json.loads((INPUT/'catalog.json').read_text());batch=next((x for x in args if x.startswith('batch=')),None)
catalog=[json.loads((INPUT/(e['id']+'.json')).read_text()) for e in catalog]
catalog.append({'id':'ready-idle','label':'Поза ожидания','duration':6.0,'source':'Adobe Mixamo Standing Idle; body clearance adaptation','review':'mechanical-idle','handMechanics':'workshop-parameter-curves-v1'})
if ids:catalog=[e for e in catalog if e['id'] in ids]
if batch:
 index,total=map(int,batch.split('=')[1].split('/'));catalog=[e for i,e in enumerate(catalog) if i%total==index]

def set_pose(row,loc):
 for b in bones:b.rotation_quaternion=row[b.name];b.location=loc[b.name]
 bpy.context.view_layer.update()

def apply_clearance(row,loc,arms,shift,bend=0):
 set_pose(row,loc);forearm_twist.clear()
 for side in ['Left','Right']:
  a=arms[side];w=a['wrist'].copy();w.y-=shift
  shoulder=B(side+'Arm').head.copy();axis=(w-shoulder).normalized()
  original=a['elbow']-shoulder;original-=axis*original.dot(axis);original.normalize()
  front=V((0,-1,0));front-=axis*front.dot(axis)
  if front.length<.001:front=original.copy()
  front.normalize();angle=math.atan2(axis.dot(original.cross(front)),original.dot(front));
  if 'frontAngle' in a:angle=a['frontAngle']+(angle-a['frontAngle']+math.pi)%(2*math.pi)-math.pi
  pole=Quaternion(axis,angle*bend)@original
  forearm_twist[side]=a['roll'];forearm_twist[side+'_origin']=a['roll']
  tracked_arm(side,w,a['rotation'],pole_override=pole)
  # Transport the source forearm twist along the corrected reach. Re-solving
  # roll from atan2 against a new elbow plane can jump to a different branch.
  elbow=B(side+'ForeArm').head.copy();wrist=B(side+'Hand').head.copy();handq=B(side+'Hand').matrix.to_quaternion()
  transport=(a['wrist']-a['elbow']).rotation_difference(wrist-elbow)
  for part,q in a['rollQuaternions'].items():put(B(side+part),elbow,transport@q)
  put(B(side+'Hand'),wrist,handq)
 bpy.context.view_layer.update()

for entry in catalog:
 id=entry['id'];started=time.time()
 previous_clearance=entry.get('bodyClearance')
 if previous_clearance and not refine_input:raise RuntimeError('Already corrected; regenerate v6 input or pass input=<original directory>')
 for ob in [rig,*rig.children_recursive]:ob.animation_data_clear()
 sc.render.fps=30;before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'frontend/public/avatars/mixamo-trial/standing-idle.glb' if id=='ready-idle' else INPUT/(id+'.glb')))
 added=set(bpy.data.objects)-before;src=next(o for o in added if o.type=='ARMATURE');rig.animation_data_create();rig.animation_data.action=src.animation_data.action;rig.animation_data.action_slot=src.animation_data.action_slot
 start,end=rig.animation_data.action.frame_range;count=round(end-start)+1;rows=[];locs=[];arms=[];raw_shifts=[];raw_bends=[];before_max=0
 for i in range(count):
  sc.frame_set(round(start)+i);bpy.context.view_layer.update()
  rows.append({b.name:b.rotation_quaternion.copy() for b in bones});locs.append({b.name:b.location.copy() for b in bones})
  arms.append({side:{'wrist':B(side+'Hand').head.copy(),'elbow':B(side+'ForeArm').head.copy(),'rotation':B(side+'Hand').matrix.to_quaternion()@B(side+'Hand').bone.matrix_local.to_quaternion().inverted()} for side in ['Left','Right']})
 # Recover the unwrapped source roll from its middle helper. Resetting the
 # roll origin to atan2 each frame creates 360-degree branch jumps.
 for row,loc,a in zip(rows,locs,arms):
  set_pose(row,loc)
  for side in ['Left','Right']:
   axis=(B(side+'Hand').head-B(side+'ForeArm').head).normalized()
   middle=B(side+'ForearmRoll1').matrix.to_quaternion()@B(side+'ForearmRoll0').matrix.to_quaternion().inverted()
   if middle.w<0:middle.negate()
   a[side]['roll']=2*math.atan2(V((middle.x,middle.y,middle.z)).dot(axis),middle.w)/.48
   a[side]['rollQuaternions']={part:B(side+part).matrix.to_quaternion().copy() for part in ['ForeArm','ForearmRoll0','ForearmRoll1','ForearmRoll2']}
 # Unwrap the elbow's route around the shoulder-wrist axis over time.
 # Opposite poles have two equivalent +/-pi solutions; switching between them
 # halfway through a correction made the elbow/forearm flip across the body.
 for side in ['Left','Right']:
  previous=None
  for row,loc,a in zip(rows,locs,arms):
   set_pose(row,loc);shoulder=B(side+'Arm').head;axis=(a[side]['wrist']-shoulder).normalized()
   pole=a[side]['elbow']-shoulder;pole-=axis*pole.dot(axis);pole.normalize()
   front=V((0,-1,0));front-=axis*front.dot(axis);front.normalize()
   angle=math.atan2(axis.dot(pole.cross(front)),pole.dot(front))
   if previous is not None:angle=previous+(angle-previous+math.pi)%(2*math.pi)-math.pi
   a[side]['frontAngle']=angle;previous=angle
 rig.animation_data_clear()
 for ob in added:bpy.data.objects.remove(ob,do_unlink=True)
 # Solve actual skinned vertices, not just the wrist pivot. Both hands share
 # the same depth offset so book/paired gestures preserve their relative depth.
 for row,loc,a in zip(rows,locs,arms):
  set_pose(row,loc);before_max=max(before_max,max(v['deficit'] for v in clearance.inspect(margin=0,stride=3).values()))
  shift=0;bend=0
  for iteration in range(10):
   candidates=[]
   for candidate in [0,.25,.5,.75,1]:
    apply_clearance(row,loc,a,shift,candidate)
    deficit=max(v['deficit'] for v in clearance.inspect(stride=3).values())
    candidates.append((deficit+.0001*candidate,deficit,candidate))
    if deficit<.0005:break
   _,deficit,bend=min(candidates)
   if deficit<.0005:break
   shift+=max(.003,deficit*1.05)
   if shift>.38:break
  raw_shifts.append(shift);raw_bends.append(bend)
 # Smooth an upper envelope rather than averaging into the body. Anticipation
 # keeps the wrist from jumping when a fingertip first touches the surface.
 shifts=[]
 for i,value in enumerate(raw_shifts):
  shifts.append(max(raw_shifts[j]*math.exp(-((i-j)/7)**2) for j in range(max(0,i-18),min(count,i+19))))
 shifts=[sum(shifts[max(0,min(count-1,i+d))]*w for d,w in zip(range(-2,3),[1,4,6,4,1]))/16 for i in range(count)]
 # Idle needs room for the runtime quaternion crossfade into signing poses.
 shifts=[max(a,b)+(.09 if id=='ready-idle' else .003) for a,b in zip(shifts,raw_shifts)]
 bends=[max(raw_bends[j]*math.exp(-((i-j)/7)**2) for j in range(max(0,i-18),min(count,i+19))) for i in range(count)]
 for refine in range(3):
  corrected=[];corrected_locs=[];after_max=0;failed=[];extra=[0]*count
  for i,(row,loc,a,shift) in enumerate(zip(rows,locs,arms,shifts)):
   apply_clearance(row,loc,a,shift,bends[i])
   result=clearance.inspect(margin=0,stride=1);deficit=max(v['deficit'] for v in result.values());after_max=max(after_max,deficit)
   if deficit>.001:
    failed.append({'frame':i+1,'depth':deficit});extra[i]=deficit*1.2+.006
   corrected.append({b.name:b.rotation_quaternion.copy() for b in bones});corrected_locs.append({b.name:b.location.copy() for b in bones})
  if not failed:break
  for i in range(count):shifts[i]+=max(extra[j]*math.exp(-((i-j)/7)**2) for j in range(max(0,i-18),min(count,i+19)))
 if after_max>.002:
  print('UNRESOLVED',id,after_max,failed,flush=True);continue
 for previous,current in zip(corrected,corrected[1:]):
  for name,q in current.items():
   if previous[name].dot(q)<0:q.negate()
 peak=max((math.degrees(a[n].rotation_difference(b[n]).angle),n,i+1) for i,(a,b) in enumerate(zip(corrected,corrected[1:])) for n in a);print('PEAK',entry['label'],peak,flush=True)
 times=coordinated_times(corrected)
 for i,row in enumerate(corrected):
  for b in bones:
   b.rotation_quaternion=row[b.name];b.location=corrected_locs[i][b.name]
   for prop in ['rotation_quaternion','location','scale']:b.keyframe_insert(prop,frame=1+times[i]*30,group=b.name)
 sc.frame_start=1;sc.frame_end=math.ceil(times[-1]*30)+1
 for b in bones:
  b.rotation_quaternion=corrected[-1][b.name];b.location=corrected_locs[-1][b.name]
  for prop in ['rotation_quaternion','location','scale']:b.keyframe_insert(prop,frame=sc.frame_end,group=b.name)
 rig.animation_data.action.name=id
 for fc in rig.animation_data.action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
 measured_peak=0;previous={}
 for f in range(1,sc.frame_end+1):
  sc.frame_set(f)
  for b in bones:
   q=b.rotation_quaternion.normalized()
   if b.name in previous:measured_peak=max(measured_peak,math.degrees(previous[b.name].rotation_difference(q).angle))
   previous[b.name]=q.copy()
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True)
 entry['leadIn']=times[min(count-1,round(entry.get('leadIn',.7)*30))];entry['leadOut']=(sc.frame_end-1)/30-times[max(0,count-1-round(entry.get('leadOut',.7)*30))]
 entry['url']='/avatars/sign-motion/'+id+'.glb';entry['maxJointStepDegrees']=measured_peak
 if 'finalWristErrorMeters' in entry:entry['sourceWristFitErrorMeters']=entry.pop('finalWristErrorMeters')
 source_times=times
 if previous_clearance:
  def remap_time(t):
   f=min(t*30,len(times)-1);i=int(f);return times[i]+(times[min(i+1,len(times)-1)]-times[i])*(f-i)
  source_times=[remap_time(t) for t in previous_clearance['sourceFrameTimes']]
 entry.update({'motionVersion':7,'bodyClearance':{'method':'evaluated torso/head/shirt front-surface clearance; paired-hand depth offset and elbow IK','beforeMaxMeters':before_max,'afterMaxMeters':after_max,'maxOffsetMeters':max(shifts),'failedFrames':failed,'refinementPasses':(previous_clearance or {}).get('refinementPasses',0)+int(refine_input),'sourceFrameTimes':[round(t,6) for t in source_times]},'duration':(sc.frame_end-1)/30})
 entry.pop('transitionPose',None);(OUT/(id+'.json')).write_text(json.dumps(entry,ensure_ascii=False,indent=2))
 print('CLEARANCE',entry['label'],'before',round(before_max*1000,1),'after',round(after_max*1000,1),'offset',round(max(shifts)*1000,1),'sec',round(time.time()-started,1),flush=True)
