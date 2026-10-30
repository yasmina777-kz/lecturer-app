"""Retarget traceable human reference landmarks to Mira's Blender skeleton.
Exports compact animation-only GLBs, never a new mesh per word.
Output is an unreviewed motion study, not a grammatical translation.
"""
from pathlib import Path
import sys,json,math
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'art/mira-blender-v3/animate.py';scope={'__file__':str(source)}
exec(compile(source.read_text().split('\nface=bpy.data.objects')[0].replace('limit=math.radians(52)','limit=math.radians(100)'),str(source),'exec'),scope)
globals().update({k:v for k,v in scope.items() if not k.startswith('__')})
OUT=ROOT/'frontend/public/avatars/sign-motion';OUT.mkdir(exist_ok=True)
DATA=ROOT/'ml/rsl/data/motion';selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [];render_stills='render' in selected;selected=[x for x in selected if x!='render']
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
manifest=[]
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
 sc.frame_start=1;sc.frame_end=count;previous={};maxstep=0;peak={};hinge_error=0;rotation_samples=[];location_samples=[]
 for frame in range(1,count+1):
  t=(frame-1)/30;sc.frame_set(frame)
  src=max(0,min(frames[-1]['t'],t-lead));a=max((i for i,f in enumerate(frames) if f['t']<=src),default=0);b=min(a+1,N-1);u=(src-frames[a]['t'])/max(.0001,frames[b]['t']-frames[a]['t']) if b!=a else 0
  fade=clamp(smooth(0,lead,t)*(1-smooth(duration-tail,duration,t)),0,1)
  for bone in bones:bone.matrix_basis=Matrix.Identity(4)
  natural_body(t)
  # Subtle torso tilt follows the reference shoulder line, not an idle loop.
  pa=frames[a]['pose'];pb=frames[b]['pose'];p=[V(x).lerp(V(y),u) for x,y in zip(pa,pb)]
  tilt=clamp(math.atan2(p[11].y-p[12].y,(p[11].x-p[12].x)*d['aspect']),-.14,.14)
  B('Spine2').rotation_quaternion=Quaternion((0,1,0),-.4*tilt*fade)@B('Spine2').rotation_quaternion
  bpy.context.view_layer.update()
  for side,wi in [('Left',15),('Right',16)]:
   for name in finger_indices:
    for j in range(1,4):
     bone=B(side+'Hand'+name+str(j));direction=(bone.bone.tail_local-bone.bone.head_local).normalized();axis=hinge_axis(side,name,j);bone.rotation_quaternion=Quaternion(axis,relaxed[name][j-1])
   sign=1 if side=='Left' else -1;start=V((sign*.205,-.105,.94));qrest=qrestL if side=='Left' else qrestR
   if not tracks[side][a] or coverage[side]<.12:
    tracked_arm(side,start,qrest);continue
   hand={key:[V(pa).lerp(V(pb),u) for pa,pb in zip(tracks[side][a][key],tracks[side][b][key])] for key in ['world','image']}
   posea=frames[a]['pose'] or next(f['pose'] for f in frames if f['pose']);poseb=frames[b]['pose'] or posea;p=[V(x).lerp(V(y),u) for x,y in zip(posea,poseb)]
   mid=(p[11]+p[12])/2;span=max(.08,math.hypot((p[11].x-p[12].x)*d['aspect'],p[11].y-p[12].y));scale=rig_span/span;w=hand['image'][0]
   # Image x/y preserve the observed position relative to shoulders; pose gives depth.
   wa=frames[a]['world'];wb=frames[b]['world'];world=[V(x).lerp(V(y),u) for x,y in zip(wa,wb)] if wa and wb else wa;depth=-.20
   if world:
    middepth=(world[11][2]+world[12][2])/2;depth=max(-.44,min(-.08,(world[wi][2]-middepth)))
   target=V(((w.x-mid.x)*d['aspect']*scale,depth,shoulder_mid.z-(w.y-mid.y)*scale))
   target.x=max(-.60,min(.60,target.x));target.z=max(.78,min(1.78,target.z))
   pts=[cv(x) for x in hand['world']];forward=(pts[9]-pts[0]).normalized();across=(pts[5]-pts[17]).normalized()
   if side=='Left':across=-across
   normal=across.cross(forward).normalized();q=orient(side,forward,normal)
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
  rotation_samples.append({bone.name:bone.rotation_quaternion.copy() for bone in bones})
  location_samples.append({bone.name:bone.location.copy() for bone in bones})
 # Bake symmetric smooth rotations after solving: no independent delayed joint chase.
 rotation_samples=smooth_rotations(rotation_samples)
 for frame,row in enumerate(rotation_samples,1):
  sc.frame_set(frame)
  for bone in bones:
   q=row[bone.name];old=previous.get(bone.name)
   if old and old.dot(q)<0:q.negate()
   if old:
    step=old.rotation_difference(q).angle
    if step>maxstep:maxstep=step;peak={'bone':bone.name,'frame':frame,'angle':math.degrees(step)}
   previous[bone.name]=q.copy();bone.rotation_quaternion=q
   bone.location=location_samples[frame-1][bone.name]
   # Fingers remain on their authored rest offsets: no sliding knuckles.
   if 'Hand' in bone.name and any(name in bone.name for name in finger_indices):bone.location=V((0,0,0))
   if 'Hand' in bone.name and bone.name[-1:] in ['2','3'] and any(name in bone.name for name in finger_indices):
    side='Left' if 'Left' in bone.name else 'Right';name=next(name for name in finger_indices if name in bone.name)
    axis=hinge_axis(side,name,int(bone.name[-1]));vector=V((q.x,q.y,q.z));hinge_error=max(hinge_error,vector.cross(axis).length)
   assert all(math.isfinite(v) for v in q)
   for prop in ['location','rotation_quaternion','scale']:bone.keyframe_insert(prop,frame=frame,group=bone.name)
 rig.animation_data.action.name=entry['id']
 for fc in rig.animation_data.action.fcurves:
  for key in fc.keyframe_points:key.interpolation='LINEAR'
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(entry['id']+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True,export_yup=True)
 info={'id':entry['id'],'label':entry['label'],'url':'/avatars/sign-motion/'+entry['id']+'.glb','duration':round((count-1)/30,3),'source':entry['source'],'reference':entry['video'],'handCoverage':coverage,'maxGapFrames':longest,'poseCoverage':d['poseCoverage'],'maxJointStepDegrees':round(math.degrees(maxstep),3),'review':'experimental-unreviewed','method':'Constrained whole-finger chain fitting on Mixamo-calibrated joint axes, captured palm targets, elbow IK and symmetric smoothing; no translation training','motionVersion':4,'peakStep':peak,'leadIn':lead,'leadOut':tail,'maxHingeOffAxis':hinge_error,'meanFingerDirectionErrorDegrees':math.degrees(sum(finger_fit_errors)/max(1,len(finger_fit_errors)))}
 if entry['id'] in HAND_POSE_CORRECTIONS:
  info['trackedFitErrorBeforeCorrectionDegrees']=info.pop('meanFingerDirectionErrorDegrees');info['handPoseCorrection']='authored-fist-v1';info['method']+='; explicit authored А fist and thumb correction'
 (OUT/(entry['id']+'.json')).write_text(json.dumps(info,ensure_ascii=False,indent=2));manifest.append(info)
 print('RETARGETED',entry['label'],info['duration'],coverage,flush=True)
 # Keep a concrete Blender workshop for manual finger/curve review.
 if entry['id']=='word-a8989f04':
  sc.frame_set(round((lead+frames[-1]['t']/2)*30)+1)
  bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/sign-motion/Avatar-motion-workshop.blend'),compress=True)
 # Optional stills for comparison, only the initial test set.
 if render_stills:
  sc.frame_set(round((lead+frames[-1]['t']/2)*30)+1);sc.camera.location=(0,-2.25,1.4);sc.camera.rotation_euler=(V((0,-.1,1.3))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.lens=55;sc.render.resolution_percentage=35;sc.render.filepath=str(ROOT/'art/sign-motion'/(entry['id']+'.png'));bpy.ops.render.render(write_still=True)
print('RETARGET_COMPLETE',len(manifest),flush=True)
