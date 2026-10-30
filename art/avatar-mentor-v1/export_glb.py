import bpy
from pathlib import Path
OUT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(OUT/'AI-Mentor-Teacher-v1.blend'))
r=bpy.data.objects['AI_Mentor_Rig']
for owner in [r]+[o.data.shape_keys for o in bpy.data.objects if o.type=='MESH' and o.data.shape_keys]:
 if owner.animation_data:
  for t in owner.animation_data.nla_tracks:t.mute=False
bpy.context.scene.frame_set(1)
for ob in bpy.data.collections['MENTOR • character'].objects:
 if ob.type!='MESH':continue
 bpy.context.view_layer.objects.active=ob
 for modifier in list(ob.modifiers):
  if modifier.type=='ARMATURE':continue
  if ob.data.shape_keys:
   ob.modifiers.remove(modifier)
  else:
   bpy.ops.object.modifier_apply(modifier=modifier.name)

bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.collections['MENTOR • character'].objects:o.select_set(True)
bpy.context.view_layer.objects.active=r
bpy.ops.export_scene.gltf(filepath=str(OUT/'ai-mentor-teacher-v1.glb'),export_format='GLB',export_apply=False,use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_skins=True,export_morph=True,export_yup=True)
