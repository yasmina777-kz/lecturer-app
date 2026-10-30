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
DATA=ROOT/'ml/rsl/data/motion';selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
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
  # Symmetric three-frame filter removes detector jitter without frame lag.
  tracks[side]=[{key:[[sum(track[k][key][j][c] for k in range(max(0,i-1),min(N,i+2)))/(min(N,i+2)-max(0,i-1)) for c in range(3)] for j in range(21)] for key in ['world','image']} if r else None for i,r in enumerate(track)]
 if max(coverage.values())<.65:continue
 for ob in [rig,*rig.children_recursive]:ob.animation_data_clear()
 face=bpy.data.objects['Mira • continuous human mesh'].data.shape_keys;face.animation_data_clear()
 lead=.35;tail=.35;duration=frames[-1]['t']+lead+tail;count=round(duration*30)+1
 sc.frame_start=1;sc.frame_end=count;previous={};maxstep=0
 for frame in range(1,count+1):
  t=(frame-1)/30;sc.frame_set(frame)
  src=max(0,min(frames[-1]['t'],t-lead));a=max((i for i,f in enumerate(frames) if f['t']<=src),default=0);b=min(a+1,N-1);u=(src-frames[a]['t'])/max(.0001,frames[b]['t']-frames[a]['t']) if b!=a else 0
  fade=smooth(0,lead,t)*(1-smooth(duration-tail,duration,t))
  for bone in bones:bone.matrix_basis=Matrix.Identity(4)
  # Keep the torso neutral: no invented grammatical facial expression.
  B('Spine2').rotation_quaternion=Quaternion((1,0,0),.012*fade)
  bpy.context.view_layer.update()
  for side,wi in [('Left',15),('Right',16)]:
   for name in finger_indices:
    for j in range(1,4):
     bone=B(side+'Hand'+name+str(j));direction=(bone.bone.tail_local-bone.bone.head_local).normalized();axis=bone.bone.matrix_local.to_quaternion().inverted()@direction.cross(rest[side]['basis'].col[2]).normalized();bone.rotation_quaternion=Quaternion(axis,relaxed[name][j-1])
   sign=1 if side=='Left' else -1;start=V((sign*.205,-.105,.94));qrest=qrestL if side=='Left' else qrestR
   if not tracks[side][a] or coverage[side]<.12:
    arm(side,start,qrest,t);continue
   hand={key:[V(pa).lerp(V(pb),u) for pa,pb in zip(tracks[side][a][key],tracks[side][b][key])] for key in ['world','image']}
   posea=frames[a]['pose'] or next(f['pose'] for f in frames if f['pose']);poseb=frames[b]['pose'] or posea;p=[V(x).lerp(V(y),u) for x,y in zip(posea,poseb)]
   mid=(p[11]+p[12])/2;span=max(.08,math.hypot((p[11].x-p[12].x)*d['aspect'],p[11].y-p[12].y));scale=rig_span/span;w=hand['image'][0]
   # Image x/y preserve the observed position relative to shoulders; pose gives depth.
   world=frames[a]['world'];depth=-.20
   if world:
    middepth=(world[11][2]+world[12][2])/2;depth=max(-.44,min(-.08,(world[wi][2]-middepth)))
   target=V(((w.x-mid.x)*d['aspect']*scale,depth,shoulder_mid.z-(w.y-mid.y)*scale))
   target.x=max(-.60,min(.60,target.x));target.z=max(.78,min(1.78,target.z))
   pts=[cv(x) for x in hand['world']];forward=(pts[9]-pts[0]).normalized();across=(pts[5]-pts[17]).normalized()
   if side=='Left':across=-across
   normal=across.cross(forward).normalized();q=orient(side,forward,normal)
   arm(side,start.lerp(target,fade),qrest.slerp(q,fade),t)
   # Retarget observed segment directions while preserving the avatar's bone lengths.
   for name,ids in finger_indices.items():
    for j in range(1,4):
     bone=B(side+'Hand'+name+str(j));desired=(pts[ids[j]]-pts[ids[j-1]]).normalized();current=(bone.tail-bone.head).normalized();rotation=current.rotation_difference(desired);qcurrent=bone.matrix.to_quaternion();put(bone,bone.head.copy(),qcurrent.slerp(rotation@qcurrent,fade))
  for bone in bones:
   old=previous.get(bone.name)
   if old:
    if old.dot(bone.rotation_quaternion)<0:bone.rotation_quaternion.negate()
    # Limit tracking flips, not the stable target pose; maximum angular rate 360°/s.
    angle=old.rotation_difference(bone.rotation_quaternion).angle
    if angle>math.radians(12):bone.rotation_quaternion=old.slerp(bone.rotation_quaternion,math.radians(12)/angle)
    maxstep=max(maxstep,old.rotation_difference(bone.rotation_quaternion).angle)
   previous[bone.name]=bone.rotation_quaternion.copy()
   assert all(math.isfinite(v) for v in bone.rotation_quaternion)
   for prop in ['location','rotation_quaternion','scale']:bone.keyframe_insert(prop,frame=frame,group=bone.name)
 rig.animation_data.action.name=entry['id']
 for fc in rig.animation_data.action.fcurves:
  for key in fc.keyframe_points:key.interpolation='LINEAR'
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(entry['id']+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True,export_yup=True)
 info={'id':entry['id'],'label':entry['label'],'url':'/avatars/sign-motion/'+entry['id']+'.glb','duration':round((count-1)/30,3),'source':entry['source'],'reference':entry['video'],'handCoverage':coverage,'maxGapFrames':longest,'poseCoverage':d['poseCoverage'],'maxJointStepDegrees':round(math.degrees(maxstep),3),'review':'experimental-unreviewed','method':'MediaPipe capture retargeted in Blender; no translation training'}
 (OUT/(entry['id']+'.json')).write_text(json.dumps(info,ensure_ascii=False,indent=2));manifest.append(info)
 print('RETARGETED',entry['label'],info['duration'],coverage,flush=True)
 # Optional stills for comparison, only the initial test set.
 if selected:
  sc.frame_set(round((lead+frames[-1]['t']/2)*30)+1);sc.camera.location=(0,-2.25,1.4);sc.camera.rotation_euler=(V((0,-.1,1.3))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.lens=55;sc.render.resolution_percentage=35;sc.render.filepath=str(ROOT/'art/sign-motion'/(entry['id']+'.png'));bpy.ops.render.render(write_still=True)
print('RETARGET_COMPLETE',len(manifest),flush=True)
