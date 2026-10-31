"""Render the actual skinned hand at three flexion levels, in Blender DQ mode."""
from pathlib import Path
source=Path(__file__).with_name('retarget.py');__file__=str(source)
exec(compile(source.read_text().split('manifest=[]')[0],str(source),'exec'),globals())
for ob in rig.children_recursive:
 if ob.type=='MESH':
  for mod in ob.modifiers:
   if mod.type=='ARMATURE':mod.use_deform_preserve_volume=True
init_finger_rigs()
sc.render.resolution_x=720;sc.render.resolution_y=720;sc.render.resolution_percentage=100;sc.cycles.samples=16
for label,curl in [('open',0),('half',.5),('closed',1)]:
 for b in bones:b.matrix_basis=Matrix.Identity(4)
 for side in ['Left','Right']:
  tracked_arm(side,V(((-.21 if side=='Right' else .21),-.27,1.4)),orient(side,(0,0,1),(0,-1,0)))
  for name in finger_indices:
   opened=flat_shape(side).get(name,[math.radians(v) for v in [-30,20,0,0]])
   closed=[math.radians(v) for v in ([68,0,82,42] if name!='Thumb' else [18,30,25,15])]
   angles=project_finger_values(side,name,[a*(1-curl)+b*curl for a,b in zip(opened,closed)])
   _,rotations=finger_chain(side,name,angles)
   for j,q in enumerate(rotations,1):B(side+'Hand'+name+str(j)).rotation_quaternion=q
 bpy.context.view_layer.update()
 target=B('RightHand').head+V((0,0,.085))
 sc.camera.location=target+V((-.08,-.65,.03));sc.camera.rotation_euler=(target-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.lens=65
 sc.render.filepath=str(ROOT/'art/sign-motion'/('hand-'+label+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/sign-motion/Hand-quality-workshop.blend'),compress=True)
