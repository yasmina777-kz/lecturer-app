import bpy,json,math
from pathlib import Path
P=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(P/'AI-Mentor-Mira.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');sc=bpy.context.scene
start=None;end=None;invalid=[];max_scale_error=0
for frame in range(1,242):
 sc.frame_set(frame)
 values=[]
 for bone in rig.pose.bones:
  values.extend(v for row in bone.matrix for v in row)
  max_scale_error=max(max_scale_error,max(abs(s-1) for s in bone.matrix.to_scale()))
 if not all(math.isfinite(v) for v in values):invalid.append(frame)
 if frame==1:start=values
 if frame==241:end=values
report={'bones':len(rig.data.bones),'finger_bones':len([b for b in rig.data.bones if 'Hand' in b.name and any(c.isdigit() for c in b.name)]),'frames':241,'invalid_frames':invalid,'max_scale_error':max_scale_error,'loop_matrix_error':max(abs(a-b) for a,b in zip(start,end)),'expressions':[k.name for o in rig.children_recursive if o.type=='MESH' and o.data.shape_keys for k in o.data.shape_keys.key_blocks]}
(P/'validation.json').write_text(json.dumps(report,indent=2));print('VALIDATION',json.dumps(report))
assert not invalid and report['loop_matrix_error']<.0001 and max_scale_error<.0001
# Check transition poses too, not only the held poses.
sc.render.resolution_x=600;sc.render.resolution_y=720
for frame,name in [(46,'lift'),(136,'transition'),(34,'blink')]:
 sc.frame_set(frame);sc.render.filepath=str(P/(name+'.png'));bpy.ops.render.render(write_still=True)
