"""Additional RSL studies; reuse the v3 anatomical rig, export independent clips.

Reference: VOG / Let's get acquainted / This is important, 02:54 and 03:15.
These are hand-authored animation studies, pending review by an RSL signer.
Run: blender -b --python art/mira-blender-phrases/animate.py -- hello|thanks
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'art/mira-blender-phrases'
PHRASE = sys.argv[sys.argv.index('--') + 1]
assert PHRASE in ('hello', 'thanks')
# Load the existing reproducible rig setup, without its old gesture bake/export.
source = ROOT / 'art/mira-blender-v3/animate.py'
scope = {'__file__': str(source)}
exec(compile(source.read_text().split('\nface=bpy.data.objects')[0], str(source), 'exec'), scope)
globals().update({k:v for k,v in scope.items() if not k.startswith('__')})

def handshape(side, t, active, fist=False):
 for name in ['Index','Middle','Ring','Pinky','Thumb']:
  for j in range(1,4):
   b=B(side+'Hand'+name+str(j))
   delay=delays[name]+.025*(j-1)
   blend=smooth(.45+delay,1.65+delay,t)*(1-smooth(6.0+delay,7.7+delay,t))*active
   target=closed[name][j-1] if fist else (.025,.045,.025)[j-1]
   if name=='Thumb':target=(.40,.52,.24)[j-1] if fist else (.08,.12,.05)[j-1]
   amount=relaxed[name][j-1]*(1-blend)+target*blend
   direction=(b.bone.tail_local-b.bone.head_local).normalized()
   axis=b.bone.matrix_local.to_quaternion().inverted()@direction.cross(rest[side]['basis'].col[2]).normalized()
   b.rotation_quaternion=Quaternion(axis,amount)
   if j==1:
    normal=b.bone.matrix_local.to_quaternion().inverted()@rest[side]['basis'].col[2]
    spread={'Index':.015,'Middle':0,'Ring':-.015,'Pinky':-.025,'Thumb':-.12}[name]
    if name=='Thumb' and fist:spread=-.48
    b.rotation_quaternion=Quaternion(normal,spread*blend)@b.rotation_quaternion
 bpy.context.view_layer.update()

def new_pose(t):
 for b in bones:b.matrix_basis=Matrix.Identity(4)
 breath=math.sin(math.pi*t/4)
 engaged=smooth(.35,1.9,t)*(1-smooth(6,7.8,t))
 nod=smooth(2.25,3.4,t)*(1-smooth(4.9,6,t))
 B('Spine').rotation_quaternion=Quaternion((0,1,0),.012*breath)
 B('Spine2').rotation_quaternion=Quaternion((1,0,0),.012*breath+.012*engaged)
 B('Neck').rotation_quaternion=Quaternion((0,1,0),-.025*engaged)
 B('Head').rotation_quaternion=Quaternion((1,0,0),-.065*nod)@Quaternion((0,0,1),.025*engaged)
 blink=sum(math.sin(math.pi*(t-a)/.24)**2 for a in [1.1,6.7] if a<t<a+.24)
 for side in ['Left','Right']:
  B(side+'OrbicularisTop').rotation_quaternion=Quaternion((1,0,0),-.30*blink)
  B(side+'OrbicularisBottom').rotation_quaternion=Quaternion((1,0,0),.12*blink)
  B(side+'Shoulder').rotation_quaternion=Quaternion((0,0,1),(.035 if side=='Right' else -.025)*engaged*(1 if PHRASE=='hello' or side=='Right' else .2))
 bpy.context.view_layer.update()
 for side in ['Left','Right']:
  active=1 if PHRASE=='hello' or side=='Right' else 0
  handshape(side,t,active,PHRASE=='thanks')
  sign=-1 if side=='Right' else 1
  start=V((sign*.205,-.105,.94));qrest=qrestR if side=='Right' else qrestL
  lift=smooth(.40+(0 if side=='Right' else .08),2.25,t)*active
  release=smooth(6.0,7.85,t)
  if PHRASE=='hello':
   # Both open palms face the torso; fingers point toward each other.
   lower=V((sign*.235,-.265,1.055));upper=V((sign*.235,-.24,1.16))
   gesture=smooth(2.65,4.25,t)
   endpoint=arc(lower,upper,gesture,(0,-.035,.015))
   qlow=orient(side,(-sign,0,-.35),(0,1,0))
   qhigh=orient(side,(-sign,0,.20),(0,1,0))
   q=qrest.slerp(qlow,smooth(.60,2.40,t)).slerp(qhigh,gesture)
  else:
   # Closed right hand rises beside the face, then moves down towards the chin.
   lower=V((-.145,-.205,1.45));upper=V((-.045,-.245,1.345))
   gesture=smooth(3.25,5.0,t)
   endpoint=arc(lower,upper,gesture,(-.012,-.025,.025))
   qfist=orient(side,(.10,0,1),(0,1,0))
   q=qrest.slerp(qfist,smooth(.65,2.40,t)*active)
  p=arc(start,endpoint,lift,(sign*.03,-.045,.03))
  p=arc(p,start,release,(sign*.025,-.025,.015))
  q=q.slerp(qrest,smooth(6.13,7.95,t))
  arm(side,p,q,t)

face=bpy.data.objects['Mira • continuous human mesh'].data.shape_keys
face.animation_data_clear()
previous={};first=None;peak=0;maxstep=0
for frame in range(1,242):
 t=(frame-1)/30;sc.frame_set(frame);new_pose(t)
 engaged=smooth(.4,2,t)*(1-smooth(6,7.8,t))
 for name,value in [('Smile',.22+.20*engaged),('BrowLeft',.08*engaged),('BrowRight',.08*engaged)]:
  face.key_blocks[name].value=value;face.key_blocks[name].keyframe_insert('value',frame=frame)
 for b in bones:
  old=previous.get(b.name)
  if old is not None:
   if old.dot(b.rotation_quaternion)<0:b.rotation_quaternion.negate()
   maxstep=max(maxstep,old.rotation_difference(b.rotation_quaternion).angle)
  previous[b.name]=b.rotation_quaternion.copy()
  assert all(math.isfinite(x) for row in b.matrix for x in row)
  for path in ['location','rotation_quaternion','scale']:b.keyframe_insert(path,frame=frame,group=b.name)
 if frame==1:first={b.name:b.matrix.copy() for b in bones}
loop_error=max(abs(b.matrix[i][j]-first[b.name][i][j]) for b in bones for i in range(4) for j in range(4))
assert loop_error<1e-5,loop_error
rig.animation_data.action.name='Mira • '+PHRASE+' • 8 seconds'
for action in [rig.animation_data.action,face.animation_data.action]:
 for fc in action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
rig['motion_note']='RSL animation study, not a verified translation. VOG: x78RQeWwwvQ, '+('02:54' if PHRASE=='hello' else '03:15')
sc.frame_set(136);sc.camera.location=(.10,-1.85,1.40);sc.camera.rotation_euler=(V((0,-.10,1.31))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.lens=65
sc.view_settings.exposure=-.6
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT/('Mira-'+PHRASE+'.blend')),compress=True)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for ob in rig.children_recursive:
 if ob.type=='MESH':ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'frontend/public/avatars/mira-blender'/('mira-'+PHRASE+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True,export_yup=True,export_image_format='AUTO')
report={'phrase':PHRASE,'bones':len(bones),'frames':241,'loop_error':loop_error,'max_local_step_degrees':math.degrees(maxstep)}
(OUTPUT/(PHRASE+'-validation.json')).write_text(json.dumps(report,indent=2))
for frame,label in [(76,'start'),(151,'end')]:
 sc.frame_set(frame);sc.render.resolution_percentage=65;sc.render.filepath=str(OUTPUT/(PHRASE+'-'+label+'.png'));bpy.ops.render.render(write_still=True)
print('PHRASE_COMPLETE',report,flush=True)
