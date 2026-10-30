"""Retarget downloaded Mixamo Standing Idle to the existing web avatar rig."""
from pathlib import Path
import bpy,json,sys,math
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'art/mira-blender-v3/animate.py';scope={'__file__':str(source)}
exec(compile(source.read_text().split('\nface=bpy.data.objects')[0],str(source),'exec'),scope)
globals().update({k:v for k,v in scope.items() if not k.startswith('__')})
target=rig
incoming=Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else ROOT/'art/mixamo-trial/Standing Idle.fbx'
label=incoming.stem
slug={'Standing Idle':'standing-idle','Talking':'talking'}[label]
existing=set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=str(incoming))
imported=set(bpy.data.objects)-existing
src=next(o for o in imported if o.type=='ARMATURE')
action=src.animation_data.action
start,end=map(round,action.frame_range)
# The target remains our Blender rig, not the differently oriented FBX bones.
matched=[b.name for b in target.pose.bones if b.name in src.pose.bones]
assert len(matched)>=50,matched
for ob in [target,*target.children_recursive]:ob.animation_data_clear()
for bone in target.pose.bones:bone.rotation_mode='QUATERNION';bone.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
previous={};peak=0
sc.render.fps=30;sc.frame_start=1;sc.frame_end=end-start+1
for i,f in enumerate(range(start,end+1),1):
 sc.frame_set(f)
 desired={name:src.matrix_world@src.pose.bones[name].matrix for name in matched}
 for bone in target.pose.bones:
  if bone.name in desired:
   # Mixamo normalizes the source bind pose to T. Copy the posed bone axes,
   # not a T-to-pose delta onto our A-pose, and keep our connected offsets.
   posed=target.matrix_world.inverted()@desired[bone.name]
   q=posed.to_quaternion();matrix=q.to_matrix().to_4x4()
   matrix.translation=posed.translation if bone.parent is None else bone.head.copy()
   bone.matrix=matrix
   bpy.context.view_layer.update()
 for side in ['Left','Right']:
  fore=target.pose.bones['mixamorig:'+side+'ForeArm']
  for k in range(3):target.pose.bones['mixamorig:'+side+'ForearmRoll'+str(k)].matrix=fore.matrix.copy()
 for bone in target.pose.bones:
  q=bone.rotation_quaternion
  if bone.name in previous:
   if previous[bone.name].dot(q)<0:q.negate()
   peak=max(peak,previous[bone.name].rotation_difference(q).angle)
  previous[bone.name]=q.copy()
  for prop in ['location','rotation_quaternion','scale']:bone.keyframe_insert(prop,frame=i,group=bone.name)
target.animation_data.action.name='Mixamo '+label+' — Mira trial'
for obj in list(imported):bpy.data.objects.remove(obj,do_unlink=True)
sc.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/('art/mixamo-trial/Mira-Mixamo-'+slug+'.blend')),compress=True)
bpy.ops.object.select_all(action='DESELECT');target.select_set(True)
output=ROOT/'frontend/public/avatars/mixamo-trial';output.mkdir(exist_ok=True,parents=True)
bpy.ops.export_scene.gltf(filepath=str(output/(slug+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True,export_yup=True)
report={'label':label,'source':'Adobe Mixamo','sourceUrl':'https://www.mixamo.com/','duration':(end-start)/30,'frames':end-start+1,'fps':30,'matchedBones':len(matched),'peakRotationStepDegrees':math.degrees(peak),'scope':'Body movement trial, not a sign or RSL translation','url':'/avatars/mixamo-trial/'+slug+'.glb'}
(output/(slug+'.json')).write_text(json.dumps(report,indent=2))
print('MIXAMO_MOTION_READY',json.dumps(report),flush=True)
