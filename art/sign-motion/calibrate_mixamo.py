"""Derive flexion axes from the already downloaded Mixamo motion, without copying its gesture.
The output describes this specific Mira rig. No RSL labels are learned from Mixamo.
"""
from pathlib import Path
import bpy,json,math
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/mixamo-trial/Mira-Mixamo-talking.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE'); axes={};rest_bends={}
for side in ['Left','Right']:
 for finger in ['Thumb','Index','Middle','Ring','Pinky']:
  stem='mixamorig:'+side+'Hand'+finger
  # PIP supplies the flexion plane. Remove axial roll before averaging;
  # the imported clip's MCP also contains spreading, so it is not a hinge reference.
  pip=rig.pose.bones[stem+'2']; weighted=Vector((0,0,0))
  for frame in range(1,bpy.context.scene.frame_end+1):
   bpy.context.scene.frame_set(frame);q=pip.rotation_quaternion.copy()
   if q.w<0:q.negate()
   weighted+=Vector((q.x,0,q.z))
  assert weighted.length>.001,stem
  local_axis=weighted.normalized()
  world_axis=pip.bone.matrix_local.to_quaternion()@local_axis
  for j in [1,2,3]:
   bone=rig.pose.bones[stem+str(j)].bone
   axis=bone.matrix_local.to_quaternion().inverted()@world_axis
   axis.y=0;axis.normalize();axes[stem+str(j)]=list(axis)
   if j>1:
    parent=rig.pose.bones[stem+str(j-1)].bone
    a=(parent.tail_local-parent.head_local).normalized();b=(bone.tail_local-bone.head_local).normalized()
    world=bone.matrix_local.to_quaternion()@axis
    rest_bends[stem+str(j)]=math.atan2(world.dot(a.cross(b)),a.dot(b))
report={'source':'Mixamo Talking / Asking A Question With Two Hands','sourceUrl':'https://www.mixamo.com/','rig':'Mira 64 deform bones + 6 forearm helpers','method':'PIP quaternion projection onto its local XZ plane; axis transported into each rest joint frame. Rest curvature subtracted separately. Not sign language motion.','axes':axes,'restBends':rest_bends}
(ROOT/'art/sign-motion/mixamo-hand-calibration.json').write_text(json.dumps(report,indent=2))
print('CALIBRATED',len(axes),'axes',len(rest_bends),'rest bends',flush=True)
# A small body-only motion layer is taken from the user's downloaded Standing Idle.
# Hands/arms/head are deliberately excluded. Wrist IK is solved after this layer.
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/mixamo-trial/Mira-Mixamo-standing-idle.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
names=['Hips','Spine','Spine1','Spine2'];rows=[];baseline={}
for frame in range(1,bpy.context.scene.frame_end+1):
 bpy.context.scene.frame_set(frame);row={}
 for name in names:
  b=rig.pose.bones['mixamorig:'+name];q=b.rotation_quaternion.copy();loc=b.location.copy()
  if frame==1:baseline[name]=(q.copy(),loc.copy())
  row[name]={'rotation':list(baseline[name][0].inverted()@q),'location':list(loc-baseline[name][1])}
 rows.append(row)
(ROOT/'art/sign-motion/mixamo-body-calibration.json').write_text(json.dumps({'source':'Mixamo Standing Idle','fps':30,'frames':rows},separators=(',',':')))
print('BODY_CALIBRATED',len(rows),'frames',flush=True)
