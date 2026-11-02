"""Open one final exported motion on the actual avatar for manual Blender review.
Usage: blender -b --python art/sign-motion/export_workshop.py -- <motion-id> <output.blend>
The saved action is baked on deform bones; controls intentionally do not override it.
"""
from pathlib import Path
import bpy, sys, json
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
motion_id,output=sys.argv[sys.argv.index('--')+1:]
base=ROOT/'frontend/public/avatars/sign-motion'
meta=json.loads((base/(motion_id+'.json')).read_text())
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/hand-rig/Mira-Hand-Workshop.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig['controls_enabled']=0
for ob in [rig,*rig.children_recursive]:ob.animation_data_clear()
for bone in rig.pose.bones:
 if bone.name.startswith('mixamorig:'):
  for constraint in list(bone.constraints):bone.constraints.remove(constraint)
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(base/(motion_id+'.glb')))
added=set(bpy.data.objects)-before;source=next(o for o in added if o.type=='ARMATURE')
rig.animation_data_create();rig.animation_data.action=source.animation_data.action;rig.animation_data.action_slot=source.animation_data.action_slot
for ob in added:bpy.data.objects.remove(ob,do_unlink=True)
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1;scene.frame_end=round(meta['duration']*30)+1
scene.frame_set(round((meta.get('leadIn',0)+.5)*30)+1)
scene.camera.location=(0,-2.25,1.4);scene.camera.rotation_euler=(Vector((0,-.1,1.3))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.lens=55
rig['motion_reference']=meta.get('reference','');rig['motion_source']=meta.get('source','');rig['motion_review']=meta['review']
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(Path(output).resolve()),compress=True)
