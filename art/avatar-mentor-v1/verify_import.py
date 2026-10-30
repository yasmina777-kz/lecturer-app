import bpy,json
from pathlib import Path
OUT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(OUT/'AI-Mentor-Teacher-v1.blend'))
for o in list(bpy.data.collections['MENTOR • character'].objects):bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(OUT/'ai-mentor-teacher-v1.glb'))
s=bpy.context.scene;s.frame_set(1);s.camera=bpy.data.objects['Camera • portrait'];s.render.resolution_x=800;s.render.resolution_y=800;s.render.resolution_percentage=100;s.cycles.samples=20;s.render.filepath=str(OUT/'check-glb-import.png');bpy.ops.render.render(write_still=True)
rigs=[o for o in bpy.data.objects if o.type=='ARMATURE'];assert len(rigs)==1 and len(rigs[0].data.bones)==29
print('GLB REIMPORT OK')
