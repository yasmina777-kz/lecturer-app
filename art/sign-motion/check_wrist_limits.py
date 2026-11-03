"""Regression poses on the actual Mira rig, including sideways wrist kinks.
Run with Blender --background --python-exit-code 1 --python this-file.
This checks rig mechanics, not whether a pose is a correct RSL sign.
"""
from pathlib import Path
import bpy, math
from mathutils import Vector as V, Matrix, Quaternion
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/hand-rig/Mira-Hand-Workshop.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig['controls_enabled']=0
B=lambda name:rig.pose.bones['mixamorig:'+name]
for bone in rig.pose.bones:
 for constraint in list(bone.constraints):bone.constraints.remove(constraint)
rig.animation_data_clear()
def put(bone,head,rotation):
 matrix=rotation.to_matrix().to_4x4();matrix.translation=head;bone.matrix=matrix;bpy.context.view_layer.update()
exec((ROOT/'art/sign-motion/arm_anatomy.py').read_text())
# Use the common exported relaxed pose, not the straight-arm bind singularity.
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'frontend/public/avatars/sign-motion/ready-idle.glb'))
source=next(o for o in set(bpy.data.objects)-before if o.type=='ARMATURE')
rig.animation_data_create();rig.animation_data.action=source.animation_data.action;rig.animation_data.action_slot=source.animation_data.action_slot
bpy.context.scene.frame_set(int(rig.animation_data.action.frame_range[0]))
rest={b.name:(b.rotation_quaternion.copy(),b.location.copy()) for b in rig.pose.bones};rig.animation_data_clear()
def reset():
 for b in rig.pose.bones:b.rotation_quaternion=rest[b.name][0];b.location=rest[b.name][1]
 bpy.context.view_layer.update()
count=0
for side in ['Left','Right']:
 for flexion,deviation in [(0,0),(0,65),(0,-65),(75,0),(-75,0),(45,45),(-45,-45),(10,10)]:
  reset();hand=B(side+'Hand');fore=B(side+'ForeArm')
  neutral=fore.matrix.to_quaternion()@fore.bone.matrix_local.to_quaternion().inverted()@hand.bone.matrix_local.to_quaternion()
  axis=hand.bone.matrix_local.to_quaternion().inverted()@(fore.bone.tail_local-fore.bone.head_local).normalized()
  across=hand.bone.matrix_local.to_quaternion().inverted()@(B(side+'HandIndex1').bone.head_local-B(side+'HandPinky1').bone.head_local)
  across=(across-axis*across.dot(axis)).normalized();lateral=axis.cross(across).normalized()
  vector=across*math.radians(flexion)+lateral*math.radians(deviation)
  target=Quaternion(vector.normalized(),vector.length) if vector.length else Quaternion()
  wrist=hand.head.copy();put(hand,wrist,neutral@target)
  fingers={b.name:b.rotation_quaternion.copy() for b in rig.pose.bones if b.name.startswith('mixamorig:'+side+'Hand') and b!=hand}
  arm_anatomy(side,apply=True);metrics=arm_anatomy(side)
  assert metrics['wristEnvelope']<=1.0001, (side,flexion,deviation,metrics)
  assert abs(metrics['wristDeviationDegrees'])<=25.001,metrics
  assert (hand.head-wrist).length<.001,'Wrist target moved'
  assert all(abs(q.dot(rig.pose.bones[n].rotation_quaternion))>.99999 for n,q in fingers.items()),'Finger shapes changed'
  count+=1
print('WRIST REGRESSION:',count,'real-rig poses; bounded wrist, preserved hand target and finger shapes')
