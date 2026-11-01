"""Bake chart handshapes with held poses, safe arms and preserved source metadata.
Stages candidates outside the production library until visual/geometry QA.
"""
from pathlib import Path
import bpy,json,math,sys,hashlib,time
from mathutils import Vector as V,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[2];DATA=ROOT/'frontend/public/avatars/sign-motion'
OUT=ROOT/'art/alphabet-cards/candidate';OUT.mkdir(exist_ok=True)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/hand-rig/Mira-Hand-Workshop.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');sc=bpy.context.scene;sc.render.fps=30
bones=[b for b in rig.pose.bones if b.name.startswith('mixamorig:')];B=lambda n:rig.pose.bones['mixamorig:'+n]
for b in bones:
 b.rotation_mode='QUATERNION'
 for c in list(b.constraints):b.constraints.remove(c)
rig.animation_data_clear()
for o in rig.children_recursive:
 if o.type=='MESH':
  for m in o.modifiers:
   if m.type=='ARMATURE':m.use_deform_preserve_volume=True

def basis(f,n):
 f=V(f).normalized();n=(V(n)-f*V(n).dot(f)).normalized();return Matrix((f.cross(n).normalized(),f,n)).transposed()
rest={}
for side in ['Right','Left']:
 wrist=B(side+'Hand').bone.head_local
 f=(B(side+'HandMiddle3').bone.tail_local-wrist).normalized()
 x=(B(side+'HandIndex1').bone.head_local-B(side+'HandPinky1').bone.head_local).normalized()*(-1 if side=='Left' else 1)
 base=basis(f,x.cross(f));rest[side]={'basis':base,'across':base.col[0].copy(),'wrist':wrist.copy()}
def put(b,head,q):
 m=q.to_matrix().to_4x4();m.translation=head;b.matrix=m;bpy.context.view_layer.update()
def smooth(a,b,t):
 u=max(0,min(1,(t-a)/(b-a)));return u*u*u*(u*(u*6-15)+10)
finger_indices={'Thumb':[1,2,3,4],'Index':[5,6,7,8],'Middle':[9,10,11,12],'Ring':[13,14,15,16],'Pinky':[17,18,19,20]}
relaxed={'Index':(.18,.26,.12),'Middle':(.24,.32,.15),'Ring':(.30,.37,.18),'Pinky':(.36,.42,.20),'Thumb':(.14,.20,.10)}
exec((ROOT/'art/sign-motion/kinematics.py').read_text())
exec((ROOT/'art/sign-motion/hand_pose_overrides.py').read_text())
exec((ROOT/'art/hand-rig/poses.py').read_text())
exec((ROOT/'art/sign-motion/arm_anatomy.py').read_text())
exec((ROOT/'art/sign-motion/trajectory.py').read_text())
exec((ROOT/'art/sign-motion/body_clearance.py').read_text());clearance=BodyClearance(rig)
exec((ROOT/'art/alphabet-cards/chart_poses.py').read_text())
def capture():return {b.name:(b.rotation_quaternion.copy(),b.location.copy()) for b in bones}
def restore(row):
 for b in bones:b.rotation_quaternion=row[b.name][0];b.location=row[b.name][1]
 bpy.context.view_layer.update()
def load_pose(id,t):
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(DATA/(id+'.glb')));added=set(bpy.data.objects)-before;src=next(o for o in added if o.type=='ARMATURE')
 rig.animation_data_create();rig.animation_data.action=src.animation_data.action;rig.animation_data.action_slot=src.animation_data.action_slot;sc.frame_set(int(1+t*30));row=capture();rig.animation_data_clear()
 for ob in added:bpy.data.objects.remove(ob,do_unlink=True)
 return row
anchor=load_pose('ready-idle',0)
# Fixed presentation target measured from the pre-chart letter В (bfde1d7).
# Do not read a generated letter here: that would drift on repeated bakes.
up_wrist=V((-.12041494250297546,-.3854984641075134,1.458504557609558))
up_rotation=Quaternion((.6341300010681152,.5659176111221313,.4993283152580261,.1681899130344391))
for letter,(shape,extended,orientation,movement) in CHART.items():
 id=f'letter-{ord(letter):x}'
 if args and id not in args:continue
 started=time.time();hand=chart_hand(letter);restore(anchor)
 if orientation=='up':
  target=up_wrist.copy();rotation=up_rotation.copy()
  if letter in ['Е','Ж','О','С','Ф','Э','Ю','Я']:rotation=Quaternion((0,0,1),math.radians(55))@rotation
  if letter in ['Ж','Ф']:rotation=Quaternion((0,1,0),math.radians(45))@rotation
  if letter=='Ж':rotation=Quaternion((1,0,0),math.radians(-45))@rotation
 else:
  forward,normal={'down':((0,0,-1),(0,1,0)),'side':((-1,0,0),(0,-1,0)),'edge':((-1,0,.15),(0,0,-1))}[orientation]
  rotation=(basis(forward,normal)@rest['Right']['basis'].transposed()).to_quaternion()@B('RightHand').bone.matrix_local.to_quaternion()
  target=V((-.28,-.44,1.12 if orientation=='down' else 1.37))
 # Position the wrist with existing IK, then align the actual elbow hinges.
 tracked_arm('Right',target,rotation@B('RightHand').bone.matrix_local.to_quaternion().inverted())
 arm_anatomy('Right',apply=True)
 apply_hand('Right',hand);goal=capture();rows=[];worst=0
 for i in range(145):
  t=i/30;weight=smooth(0,1,t)*(1-smooth(3.8,4.8,t))
  restore({n:(anchor[n][0].slerp(q,weight),anchor[n][1].lerp(p,weight)) for n,(q,p) in goal.items()})
  if t>1.2 and movement:
   u=smooth(1.2,3.5,t);offset=V((0,0,0))
   if movement=='down':offset.z=-.07*u
   elif movement=='side':offset.x=.07*math.sin(2*math.pi*u)
   elif movement=='circle':offset=V((.025*math.sin(2*math.pi*u),0,.025*(1-math.cos(2*math.pi*u))))
   elif movement=='arc':offset=V((.045*math.sin(math.pi*u),0,.025*math.sin(2*math.pi*u)))
   put(B('RightHand'),B('RightHand').head+offset*(1-smooth(3.8,4.8,t)),B('RightHand').matrix.to_quaternion())
  if i not in (0,144):
   arm_anatomy('Right',apply=True)
   for attempt in range(3):
    deficit=max(v['deficit'] for v in clearance.inspect(margin=.004,stride=3).values())
    if deficit<.0005:break
    arm_anatomy('Right',apply=True,depth=deficit+.006)
  worst=max(worst,max(v['deficit'] for v in clearance.inspect(margin=0,stride=2).values()))
  rows.append(capture())
 if worst>.002:raise RuntimeError(f'{id}: overlap {worst}')
 for a,b in zip(rows,rows[1:]):
  for name,(q,_) in b.items():
   if a[name][0].dot(q)<0:q.negate()
 times=coordinated_times([{n:q for n,(q,p) in row.items()} for row in rows])
 rig.animation_data_clear()
 for i,row in enumerate(rows):
  restore(row)
  for b in bones:
   for prop in ['rotation_quaternion','location','scale']:b.keyframe_insert(prop,frame=1+times[i]*30,group=b.name)
 sc.frame_start=1;sc.frame_end=math.ceil(times[-1]*30)+1
 for b in bones:
  for prop in ['rotation_quaternion','location','scale']:b.keyframe_insert(prop,frame=sc.frame_end,group=b.name)
 rig.animation_data.action.name=id
 for fc in rig.animation_data.action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'.glb')),export_format='GLB',use_selection=True,export_def_bones=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True)
 meta=json.loads((DATA/(id+'.json')).read_text());meta.update(duration=(sc.frame_end-1)/30,leadIn=times[30],leadOut=(sc.frame_end-1)/30-times[114],chartPose={'source':'/images/rsl-alphabet/source-chart.jpg','method':'hand-authored chart pose on calibrated finger joints','holdTime':times[55],'hand':'Right','movement':movement,'review':'experimental-unreviewed'})
 meta['method']='Hand-authored chart handshape with Mixamo-calibrated finger axes, held presentation, authored movement path and anatomical arm IK; no model training'
 meta['handPoseCorrection']='chart-study-v1'
 # Recompute the exported animation's joint-speed metric; old capture fit metrics
 # describe a different pose and must not be presented as checks of this bake.
 sampled=[]
 for frame in range(1,sc.frame_end+1):
  sc.frame_set(frame);sampled.append(capture())
 meta['maxJointStepDegrees']=max(math.degrees(a[n][0].rotation_difference(b[n][0]).angle) for a,b in zip(sampled,sampled[1:]) for n in a)
 meta['maxPlaybackHingeOffAxis']=max(V((q.x,q.y,q.z)).cross(hinge_axis(side,name,j)).length for row in sampled for side in ['Right','Left'] for name in finger_indices for j in [2,3] for q,p in [row['mixamorig:'+side+'Hand'+name+str(j)]])
 meta['maxHingeOffAxis']=max(V((q.x,q.y,q.z)).cross(hinge_axis('Right',name,j)).length for name in finger_indices for j in [2,3] for q,p in [goal['mixamorig:RightHand'+name+str(j)]])
 meta['restHingeOffAxis']=max(V((q.x,q.y,q.z)).cross(hinge_axis(side,name,j)).length for side in ['Right','Left'] for name in finger_indices for j in [2,3] for q,p in [anchor['mixamorig:'+side+'Hand'+name+str(j)]])
 meta['hingeMetricScope']='maxHingeOffAxis measures the authored active-hand pose; maxPlaybackHingeOffAxis includes the unchanged idle/rest hand'
 for stale in ['meanFingerDirectionErrorDegrees','sourceWristFitErrorMeters','legacyWristDriftMeters','trackedFitErrorBeforeCorrectionDegrees','peakStep']:
  meta.pop(stale,None)
 meta['bodyClearance']={'method':'chart-pose anatomical IK and evaluated torso/head/clothing front-surface correction','afterMaxMeters':worst,'failedFrames':[]};meta['bodyClearance']['sourceFrameTimes']=[round(v,6) for v in times];meta['revision']=hashlib.sha256((OUT/(id+'.glb')).read_bytes()).hexdigest()[:12];meta.pop('transitionPose',None)
 (OUT/(id+'.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2))
 # Front-view hand render, retained locally for comparison with the chart.
 sc.frame_set(int(1+times[55]*30));pts=[rig.matrix_world@b.head for b in bones if b.name.startswith('mixamorig:RightHand')];target=(V(tuple(min(p[j] for p in pts) for j in range(3)))+V(tuple(max(p[j] for p in pts) for j in range(3))))/2
 sc.camera.location=target+V((0,-.75,0));sc.camera.rotation_euler=(target-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.type='ORTHO';sc.camera.data.ortho_scale=.29;sc.render.resolution_x=400;sc.render.resolution_y=400;sc.render.resolution_percentage=100;sc.render.engine='CYCLES';sc.cycles.samples=8;sc.render.filepath=str(OUT/(id+'.png'));bpy.ops.render.render(write_still=True)
 rig.animation_data_clear();print('CHART',letter,round(time.time()-started,1),flush=True)
