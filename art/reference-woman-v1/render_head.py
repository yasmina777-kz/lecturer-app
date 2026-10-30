import bpy,math
from mathutils import Vector
from pathlib import Path
p=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(p/'Woman-reconstructed-head.blend'))
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.cycles.use_denoising=True
sc.render.resolution_x=720;sc.render.resolution_y=900;sc.render.resolution_percentage=100
sc.world=bpy.data.worlds.new('Studio');sc.world.color=(.3,.3,.3);sc.view_settings.view_transform='Standard'
for name,loc,power,size in [('Key',(-4,-5,6),650,5),('Fill',(4,-3,2),400,5)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);sc.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Portrait');o=bpy.data.objects.new('Portrait',d);sc.collection.objects.link(o);o.location=(0,-8,.25);o.rotation_euler=(Vector((0,0,-.1))-o.location).to_track_quat('-Z','Y').to_euler();d.lens=60;sc.camera=o
sc.render.image_settings.file_format='PNG';sc.render.filepath=str(p/'head-check.png');bpy.ops.render.render(write_still=True)
