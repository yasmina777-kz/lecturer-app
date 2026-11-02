"""Retarget traceable human reference landmarks to Mira's Blender skeleton.
Exports compact animation-only GLBs, never a new mesh per word.
Output is an unreviewed motion study, not a grammatical translation.
"""
from pathlib import Path
import sys,json,math,os
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'art/mira-blender-v3/animate.py';scope={'__file__':str(source)}
exec(compile(source.read_text().split('\nface=bpy.data.objects')[0].replace('limit=math.radians(52)','limit=math.radians(100)'),str(source),'exec'),scope)
globals().update({k:v for k,v in scope.items() if not k.startswith('__')})
for ob in rig.children_recursive:
 if ob.type=='MESH':
  for mod in ob.modifiers:
   if mod.type=='ARMATURE':mod.use_deform_preserve_volume=True
OUT=Path(os.environ.get('MOTION_OUTPUT_DIR',str(ROOT/'frontend/public/avatars/sign-motion')));OUT.mkdir(parents=True,exist_ok=True)
DATA=Path(os.environ.get('MOTION_CAPTURE_DIR',str(ROOT/'ml/rsl/data/motion')));selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [];render_stills='render' in selected;selected=[x for x in selected if x!='render']
paths=sorted(DATA.glob('word-*.json'))+sorted(DATA.glob('letter-*.json'))
batch=next((x for x in selected if x.startswith('batch=')),None)
if selected==['missing']:
 paths=[p for p in paths if not (OUT/(p.stem+'.glb')).exists()];selected=[]
elif batch:
 index,total=map(int,batch.split('=')[1].split('/'));paths=[p for i,p in enumerate(paths) if i%total==index];selected=[]
elif selected:paths=[p for p in paths if p.stem in selected]
cv=lambda p:V((p[0],p[2],-p[1]))
shoulder_mid=(B('LeftArm').head+B('RightArm').head)/2
rig_span=(B('LeftArm').head-B('RightArm').head).length
finger_indices={'Thumb':[1,2,3,4],'Index':[5,6,7,8],'Middle':[9,10,11,12],'Ring':[13,14,15,16],'Pinky':[17,18,19,20]}
exec(compile((ROOT/'art/sign-motion/kinematics.py').read_text(), 'kinematics.py', 'exec'), globals())
exec(compile((ROOT/'art/sign-motion/hand_pose_overrides.py').read_text(), 'hand_pose_overrides.py', 'exec'), globals())
exec(compile((ROOT/'art/sign-motion/trajectory.py').read_text(), 'trajectory.py', 'exec'), globals())
exec(compile((ROOT/'art/hand-rig/poses.py').read_text(), 'hand-workshop-poses.py', 'exec'), globals())
exec(compile((ROOT/'art/hand-rig/weights.py').read_text(), 'weights.py', 'exec'), globals())
manifest=[]
repair_hand_weights(rig)
for path in paths:
 d=json.loads(path.read_text());entry=d['entry'];frames=d['frames'];N=len(frames)
 if d['poseCoverage']<.85:continue
 # Assign each detection to one anatomical hand by proximity to the pose wrists.
 assigned=[]
 for f in frames:
  row={};p=f['pose'];hs=f['hands']
  if p:
   pairs=sorted((math.hypot(h['image'][0][0]-p[k][0],h['image'][0][1]-p[k][1]),side,i) for i,h in enumerate(hs) for side,k in [('Left',15),('Right',16)])
   used=set()
   for distance,side,i in pairs:
    if side not in row and i not in used and distance<.24:row[side]=hs[i];used.add(i)
  assigned.append(row)
 # Short detection gaps interpolate; long gaps are marked in the report.
 tracks={};coverage={};longest={}
 for side in ['Left','Right']:
  valid=[i for i,r in enumerate(assigned) if side in r];coverage[side]=len(valid)/N
  longest[side]=0;gap=0
  for r in assigned:
   gap=0 if side in r else gap+1;longest[side]=max(longest[side],gap)
  track=[]
  for i in range(N):
   if not valid:track.append(None);continue
   a=max((v for v in valid if v<=i),default=valid[0]);b=min((v for v in valid if v>=i),default=valid[-1]);u=0 if b==a else (i-a)/(b-a)
   track.append({key:[[x*(1-u)+y*u for x,y in zip(pa,pb)] for pa,pb in zip(assigned[a][side][key],assigned[b][side][key])] for key in ['world','image']})
  # Filter observations before solving the joints, rather than chasing them with a speed cap.
  if valid:
   filtered={key:filtered_samples([r[key] for r in track]) for key in ['world','image']}
   tracks[side]=[{key:filtered[key][i] for key in filtered} for i in range(N)]
  else:tracks[side]=track
 if max(coverage.values())<.65:continue
 # Smooth shoulders/elbows/depth too; formerly these jumped at capture-frame boundaries.
 for key in ['pose','world']:
  valid=[i for i,f in enumerate(frames) if f[key]]
  if not valid:continue
  filled=[f[key] or frames[min(valid,key=lambda j:abs(j-i))][key] for i,f in enumerate(frames)]
  for f,value in zip(frames,filtered_samples(filled)):f[key]=value
 for ob in [rig,*rig.children_recursive]:ob.animation_data_clear()
 face=bpy.data.objects['Mira • continuous human mesh'].data.shape_keys;face.animation_data_clear()
 forearm_twist.clear();finger_fit_previous.clear();finger_fit_errors.clear()
 lead=.7;tail=.7;duration=frames[-1]['t']+lead+tail;count=round(duration*30)+1
 sc.frame_start=1;sc.frame_end=count;previous={};maxstep=0;peak={};hinge_error=0;rotation_samples=[];location_samples=[];arm_samples=[];hand_samples=[]
 for frame in range(1,count+1):
  t=(frame-1)/30;sc.frame_set(frame)
  src=max(0,min(frames[-1]['t'],t-lead));a=max((i for i,f in enumerate(frames) if f['t']<=src),default=0);b=min(a+1,N-1);u=(src-frames[a]['t'])/max(.0001,frames[b]['t']-frames[a]['t']) if b!=a else 0
  fade=0 if frame in (1,count) else clamp(smooth(0,lead,t)*(1-smooth(duration-tail,duration,t)),0,1)
  for bone in bones:bone.matrix_basis=Matrix.Identity(4)
  current_hand_values.clear()
  natural_body(t)
  # Subtle torso tilt follows the reference shoulder line, not an idle loop.
  pa=frames[a]['pose'];pb=frames[b]['pose'];p=[V(x).lerp(V(y),u) for x,y in zip(pa,pb)]
  tilt=clamp(math.atan2(p[11].y-p[12].y,(p[11].x-p[12].x)*d['aspect']),-.14,.14)
  B('Spine2').rotation_quaternion=Quaternion((0,1,0),-.4*tilt*fade)@B('Spine2').rotation_quaternion
  bpy.context.view_layer.update()
  for side,wi in [('Left',15),('Right',16)]:
   for name in finger_indices:apply_finger_values(side,name,neutral_finger_values(name))
   sign=1 if side=='Left' else -1;start=V((sign*.205,-.105,.94));qrest=qrestL if side=='Left' else qrestR
   if not tracks[side][a] or coverage[side]<.12:
    tracked_arm(side,start,qrest);continue
   hand={key:interpolate_landmarks(tracks[side],a,b,u,key) for key in ['world','image']}
   posea=frames[a]['pose'] or next(f['pose'] for f in frames if f['pose']);poseb=frames[b]['pose'] or posea;p=[V(x).lerp(V(y),u) for x,y in zip(posea,poseb)]
   mid=(p[11]+p[12])/2;span=max(.08,math.hypot((p[11].x-p[12].x)*d['aspect'],p[11].y-p[12].y));scale=rig_span/span;w=hand['image'][0]
   # Image x/y preserve the observed position relative to shoulders; pose gives depth.
   wa=frames[a]['world'];wb=frames[b]['world'];world=[V(x).lerp(V(y),u) for x,y in zip(wa,wb)] if wa and wb else wa;depth=-.20
   if world:
    middepth=(world[11][2]+world[12][2])/2;depth=max(-.44,min(-.08,(world[wi][2]-middepth)))
   target=V(((w.x-mid.x)*d['aspect']*scale,depth,shoulder_mid.z-(w.y-mid.y)*scale))
   if entry['id'].startswith('word-teacher-'):
    # A shoulder-width scale alone puts face signs below the face when the
    # actor and avatar have different head/shoulder proportions. Map the
    # observed nose and shoulder line to corresponding avatar landmarks.
    shoulder_z=B('Neck').bone.head_local.z-.035
    nose_z=B('Head').bone.head_local.z+.065
    vertical_scale=clamp((nose_z-shoulder_z)/max(.09,mid.y-p[0].y),scale*.7,scale*1.7)
    target.z=shoulder_z-(w.y-mid.y)*vertical_scale
   target.x=max(-.60,min(.60,target.x));target.z=max(.78,min(1.78,target.z))
   pts=[cv(x) for x in hand['world']];forward=(pts[9]-pts[0]).normalized();across=(pts[5]-pts[17]).normalized()
   if side=='Left':across=-across
   normal=across.cross(forward).normalized();q=orient(side,forward,normal)
   if entry['id']=='word-teacher-thanks' and side=='Right':
    # The VOG sample brings the closed hand sideways to the forehead, then
    # down to the chest. Monocular tracking incorrectly points its fist upward.
    q=orient(side,(1,0,.05),(0,-1,0));target.y=clamp(target.y,-.24,-.16)
   if entry['id']=='word-f1a5226d':
    # Both flat hands are edge/back-facing in this reference; the lower hand
    # must not turn into a palm-up offering pose when its depth is occluded.
    q=orient(side,(-1,0,.12) if side=='Left' else (.25,0,1),(0,1,0))
   if entry['id']=='word-9fcf26f7' and side=='Right':
    if not finger_fit_rigs:init_finger_rigs()
    thumb_dirs,_=finger_chain(side,'Thumb',[math.radians(v) for v in [-30,30,0,0]])
    direction=(q@sum(thumb_dirs,V())).normalized()
    q=direction.rotation_difference(V((.12,0,1)).normalized())@q
   if entry['id'] in ['word-0cca1e04','word-8c1a7f26'] and side=='Left':
    # The index points INTO the upper chest, not diagonally up into space.
    target.y=-.28
    q=orient(side,(-1,0,.08),(0,1,0))
   if entry['id']=='word-a8989f04':
    # One shared book hinge: independent monocular depths cannot preserve contact.
    pair={s:[V(x).lerp(V(y),u) for x,y in zip(tracks[s][a]['image'],tracks[s][b]['image'])] for s in ['Left','Right']}
    center=(pair['Left'][0]+pair['Right'][0])/2
    # The reference opens once (about 0.30–0.55 s), rotating the palms
    # toward the viewer around their ulnar edges, not fanning fingertips sideways.
    opening=math.radians(58)*smooth(.24,.42,src)*(1-smooth(.44,.62,src))
    target=V(((center.x-mid.x)*d['aspect']*scale+sign*(.018+.035*math.sin(opening)),-.29,shoulder_mid.z-(center.y-mid.y)*scale))
    rotation=Quaternion((0,0,1),sign*opening)@Quaternion((0,1,0),sign*opening*.25)
    q=orient(side,rotation@V((0,0,1)),rotation@V((-sign,0,0)))
   ei=13 if side=='Left' else 14;ep=p[ei]
   edepth=clamp(world[ei][2]-(world[11][2]+world[12][2])/2,-.35,.2) if world else -.05
   elbow_hint=V(((ep.x-mid.x)*d['aspect']*scale,edepth,shoulder_mid.z-(ep.y-mid.y)*scale))
   # Scapula follows the reach before solving elbow/wrist. The IK preserves
   # captured hand positions instead of adding an unrelated arm animation.
   shoulder=B(side+'Shoulder');local=shoulder.bone.matrix_local.to_quaternion().inverted()
   lift=clamp((elbow_hint.z-(shoulder_mid.z-.25))*.25,0,.09)*fade
   reach=clamp(-edepth*.18,0,.055)*fade
   shoulder.rotation_quaternion=Quaternion(local@V((0,1,0)),-sign*lift)@Quaternion(local@V((0,0,1)),-sign*reach)
   bpy.context.view_layer.update()
   tracked_arm(side,start.lerp(target,fade),qrest.slerp(q,fade),elbow_hint,fade)
   anatomical_fingers(side,pts,fade)
   corrected_hand_pose(entry['id'],side,fade)
  hand_samples.append({key:values.copy() for key,values in current_hand_values.items()})
  arm_samples.append({side:{'wrist':B(side+'Hand').head.copy(),'elbow':B(side+'ForeArm').head.copy(),'rotation':B(side+'Hand').matrix.to_quaternion()@B(side+'Hand').bone.matrix_local.to_quaternion().inverted()} for side in ['Left','Right']})
  rotation_samples.append({bone.name:bone.rotation_quaternion.copy() for bone in bones})
  location_samples.append({bone.name:bone.location.copy() for bone in bones})
 # Bake symmetric smooth rotations after solving: no independent delayed joint chase.
 rotation_samples=smooth_rotations(rotation_samples)
 # Interpolate anatomical DOFs, then rebuild the FK chains. Quaternion averaging
 # at MCP used to add twist that neither capture nor the workshop controls requested.
 smooth_hand_samples=filter_hand_values(hand_samples)
 for row,hands in zip(rotation_samples,smooth_hand_samples):
  for (side,name),values in hands.items():
   _,qs=finger_chain(side,name,values)
   for j,q in enumerate(qs,1):row[B(side+'Hand'+name+str(j)).name]=q
 arm_paths=coherent_arm_paths(arm_samples)
 forearm_twist.clear()
 final_wrist_error=0;legacy_wrist_drift=0;solved_rotations=[];solved_locations=[]
 for frame,row in enumerate(rotation_samples,1):
  sc.frame_set(frame)
  for bone in bones:
   bone.rotation_quaternion=row[bone.name]
   bone.location=location_samples[frame-1][bone.name]
  bpy.context.view_layer.update()
  for side in ['Left','Right']:
   path=arm_paths[frame-1][side]
   legacy_wrist_drift=max(legacy_wrist_drift,(B(side+'Hand').head-path['wrist']).length)
   tracked_arm(side,path['wrist'],path['rotation'],path['elbow'])
   final_wrist_error=max(final_wrist_error,(B(side+'Hand').head-path['wrist']).length)
  row={bone.name:bone.rotation_quaternion.copy() for bone in bones}
  locations={bone.name:bone.location.copy() for bone in bones}
  for bone in bones:
   q=row[bone.name];old=previous.get(bone.name)
   if old and old.dot(q)<0:q.negate()
   if old:
    step=old.rotation_difference(q).angle
    if step>maxstep:maxstep=step;peak={'bone':bone.name,'frame':frame,'angle':math.degrees(step)}
   previous[bone.name]=q.copy();bone.rotation_quaternion=q
   bone.location=locations[bone.name]
   # Fingers remain on their authored rest offsets: no sliding knuckles.
   if 'Hand' in bone.name and any(name in bone.name for name in finger_indices):bone.location=V((0,0,0))
   if 'Hand' in bone.name and bone.name[-1:] in ['2','3'] and any(name in bone.name for name in finger_indices):
    side='Left' if 'Left' in bone.name else 'Right';name=next(name for name in finger_indices if name in bone.name)
    axis=hinge_axis(side,name,int(bone.name[-1]));vector=V((q.x,q.y,q.z));hinge_error=max(hinge_error,vector.cross(axis).length)
   assert all(math.isfinite(v) for v in q)
  solved_rotations.append({bone.name:bone.rotation_quaternion.copy() for bone in bones})
  solved_locations.append({bone.name:bone.location.copy() for bone in bones})
 times=coordinated_times(solved_rotations)
 # Preserve the relation to the human recording through every later retime.
 # Playback must not assume the exported motion and source have equal duration.
 source_timeline=[[round(output,6),round(clamp(i/30-lead,0,frames[-1]['t']),6)] for i,output in enumerate(times)]
 lead_out_time=times[max(0,len(times)-1-round(tail*30))]
 lead=times[min(len(times)-1,round(lead*30))]
 sc.frame_end=math.ceil(times[-1]*30)+1;count=sc.frame_end
 tail=(count-1)/30-lead_out_time
 for i,(row,locations) in enumerate(zip(solved_rotations,solved_locations)):
  for bone in bones:
   bone.rotation_quaternion=row[bone.name];bone.location=locations[bone.name]
   for prop in ['location','rotation_quaternion','scale']:bone.keyframe_insert(prop,frame=1+times[i]*30,group=bone.name)
 # Blender glTF samples through floor(action.frame_range.end), even with a
 # ceil scene end. Without this integer key it drops the neutral final pose
 # whenever whole-pose retiming ends on a fractional frame.
 for bone in bones:
  bone.rotation_quaternion=solved_rotations[-1][bone.name];bone.location=solved_locations[-1][bone.name]
  for prop in ['location','rotation_quaternion','scale']:bone.keyframe_insert(prop,frame=sc.frame_end,group=bone.name)
 rig.animation_data.action.name=entry['id']
 for fc in rig.animation_data.action.fcurves:
  for key in fc.keyframe_points:key.interpolation='LINEAR'
 # Measure the animation Blender actually samples for export after shared retiming.
 previous={};maxstep=0
 for frame in range(1,count+1):
  sc.frame_set(frame)
  for bone in bones:
   q=bone.rotation_quaternion.normalized();old=previous.get(bone.name)
   if old:
    step=old.rotation_difference(q).angle
    if step>maxstep:maxstep=step;peak={'bone':bone.name,'frame':frame,'angle':math.degrees(step)}
   previous[bone.name]=q.copy()
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(entry['id']+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True,export_yup=True)
 info={'id':entry['id'],'label':entry['label'],'url':'/avatars/sign-motion/'+entry['id']+'.glb','duration':round((count-1)/30,3),'source':entry['source'],'reference':entry['video'],'handCoverage':coverage,'maxGapFrames':longest,'poseCoverage':d['poseCoverage'],'maxJointStepDegrees':round(math.degrees(maxstep),3),'review':'experimental-unreviewed','method':'Constrained whole-finger chain fitting on Mixamo-calibrated joint axes, monotone captured palm trajectories, final coordinated elbow IK, workshop hand priors and anatomical-parameter finger curves; no translation training','motionVersion':6,'handMechanics':'workshop-parameter-curves-v1','finalWristErrorMeters':final_wrist_error,'legacyWristDriftMeters':legacy_wrist_drift,'timing':'whole-pose retiming at 240 degrees/second; no independent joint slowdown','peakStep':peak,'leadIn':lead,'leadOut':tail,'maxHingeOffAxis':hinge_error,'meanFingerDirectionErrorDegrees':math.degrees(sum(finger_fit_errors)/max(1,len(finger_fit_errors)))}
 info['sourceTimeline']=source_timeline
 if entry['id'] in HAND_POSE_CORRECTIONS or entry['id'] in REFERENCE_HAND_SHAPES:
  info['trackedFitErrorBeforeCorrectionDegrees']=info.pop('meanFingerDirectionErrorDegrees');info['handPoseCorrection']='authored-fist-v1' if entry['id'] in HAND_POSE_CORRECTIONS else 'reference-workshop-handshape-v2';info['method']+='; explicit handshape correction from the linked video reference'
 (OUT/(entry['id']+'.json')).write_text(json.dumps(info,ensure_ascii=False,indent=2));manifest.append(info)
 print('RETARGETED',entry['label'],info['duration'],coverage,'wrist drift cm',round(legacy_wrist_drift*100,2),'->',round(final_wrist_error*100,3),flush=True)
 # Keep a concrete Blender workshop for manual finger/curve review.
 if entry['id']=='word-a8989f04':
  sc.frame_set(round((lead+frames[-1]['t']/2)*30)+1)
  bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/sign-motion/Avatar-motion-workshop.blend'),compress=True)
 # Optional stills for comparison, only the initial test set.
 if render_stills:
  sc.frame_set(round((lead+frames[-1]['t']/2)*30)+1);sc.camera.location=(0,-2.25,1.4);sc.camera.rotation_euler=(V((0,-.1,1.3))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.lens=55;sc.render.resolution_percentage=35;sc.render.filepath=str(ROOT/'art/sign-motion'/(entry['id']+'.png'));bpy.ops.render.render(write_still=True)
print('RETARGET_COMPLETE',len(manifest),flush=True)
