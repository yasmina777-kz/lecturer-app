import bpy,json
from pathlib import Path
from mathutils import Vector
P=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(P/'AI-Mentor-Mira.blend'));sc=bpy.context.scene;sc.frame_set(106)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
print('POSED',json.dumps({b.name:[list(b.head),list(b.tail)] for b in rig.pose.bones if 'Hand' in b.name}))
sc.camera.location=(.04,-1.05,1.28);sc.camera.rotation_euler=(Vector((0,-.31,1.16))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.lens=65
sc.render.resolution_x=900;sc.render.resolution_y=650;sc.render.filepath=str(P/'hands-test.png');bpy.ops.render.render(write_still=True)
