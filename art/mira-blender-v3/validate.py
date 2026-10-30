import bpy,json,math
from pathlib import Path
from mathutils import Vector
P=Path(__file__).resolve().parent

def inspect(path):
 bpy.ops.wm.open_mainfile(filepath=str(path));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');sc=bpy.context.scene
 b=lambda name:rig.pose.bones['mixamorig:'+name]
 previous={};first=None;last=None;maxstep=0;maxhandstep=0;previoushands={};contacts=[];invalid=[];maxscale=0;peak_bones={}
 for frame in range(1,242):
  sc.frame_set(frame);values=[]
  for bone in rig.pose.bones:
   values.extend(v for row in bone.matrix for v in row)
   maxscale=max(maxscale,max(abs(s-1) for s in bone.matrix.to_scale()))
   q=bone.matrix.to_quaternion();old=previous.get(bone.name)
   if old is not None:
    step=2*math.acos(min(1,abs(old.dot(q))));maxstep=max(maxstep,step)
    if step>peak_bones.get(bone.name,{}).get('radians',0):peak_bones[bone.name]={'frame':frame,'radians':step}
   previous[bone.name]=q
  for side in ['Left','Right']:
   head=b(side+'Hand').head.copy()
   if side in previoushands:maxhandstep=max(maxhandstep,(head-previoushands[side]).length)
   previoushands[side]=head
  if 81<=frame<=118:contacts.append((b('RightHandMiddle3').tail-b('LeftHandThumb3').tail).length)
  if not all(math.isfinite(v) for v in values):invalid.append(frame)
  if frame==1:first=values
  if frame==241:last=values
 return {'bones':len(rig.data.bones),'frames':241,'invalid_frames':invalid,'max_scale_error':maxscale,'loop_matrix_error':max(abs(a-b) for a,b in zip(first,last)),'max_contact_error_m':max(contacts),'max_bone_step_degrees':math.degrees(maxstep),'peak_wrist_speed_m_s':maxhandstep*30,'largest_steps':sorted([{'bone':n,'frame':v['frame'],'degrees':math.degrees(v['radians'])} for n,v in peak_bones.items()],key=lambda x:-x['degrees'])[:8]}
report={'previous':inspect(P.parent/'mira-blender-v2/AI-Mentor-Mira.blend'),'updated':inspect(P/'AI-Mentor-Mira-Soft-Motion.blend')}
(P/'validation.json').write_text(json.dumps(report,indent=2));print('VALIDATION',json.dumps(report))
r=report['updated'];assert not r['invalid_frames'] and r['loop_matrix_error']<.0001 and r['max_scale_error']<.0001 and r['max_contact_error_m']<.003
