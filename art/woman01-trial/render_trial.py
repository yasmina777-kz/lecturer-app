"""Render the rigged candidate from a saved motion study, with neutral lighting."""
import bpy,sys
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];out=Path(args[0]);out.mkdir(parents=True,exist_ok=True)
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.cycles.use_denoising=True
sc.render.resolution_x=800;sc.render.resolution_y=800;sc.render.resolution_percentage=100
sc.render.image_settings.file_format='PNG';sc.use_nodes=False
sc.world=bpy.data.worlds.new('Trial world');sc.world.use_nodes=True
sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.7,.75,.85,1);sc.world.node_tree.nodes['Background'].inputs[1].default_value=.7
for name,loc,power in [('Key',(-3,-4,4),500),('Fill',(3,-2,3),350)]:
 l=bpy.data.lights.new(name,'AREA');l.energy=power;l.size=4;o=bpy.data.objects.new(name,l);sc.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.2))-o.location).to_track_quat('-Z','Y').to_euler()
c=bpy.data.objects.new('Trial camera',bpy.data.cameras.new('Trial camera'));sc.collection.objects.link(c);sc.camera=c;c.data.type='ORTHO'
for f in [0,60,100]:
 sc.frame_set(f)
 for label,loc in [('front',(0,-3,1.4)),('angle',(2,-3,1.5))]:
  c.location=loc;c.rotation_euler=(Vector((0,0,1.15))-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=1.35
  sc.render.filepath=str(out/f'{Path(bpy.data.filepath).stem}-{f}-{label}.png');bpy.ops.render.render(write_still=True)
