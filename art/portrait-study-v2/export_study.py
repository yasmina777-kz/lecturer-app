import bpy, json, numpy as np, shutil
from pathlib import Path
P=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(P/'Portrait-elvs_hazel_hair.blend'))
sc=bpy.context.scene
# Flatten the hair tint into a new texture so Blender and glTF use the same material.
mat=bpy.data.objects['Portrait hair'].data.materials[0]
bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
mix=bs.inputs['Base Color'].links[0].from_node
source=mix.inputs[1].links[0].from_node.image
pixels=np.empty(len(source.pixels),dtype=np.float32);source.pixels.foreach_get(pixels)
pixels=pixels.reshape((-1,4))
# Image buffers contain sRGB values; tint in linear light, then encode once.
rgb=pixels[:,:3];linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
linear*=np.array([.055,.035,.025]);pixels[:,:3]=np.where(linear<=.0031308,linear*12.92,1.055*linear**(1/2.4)-.055)
im=bpy.data.images.new('Chestnut hair • study texture',width=source.size[0],height=source.size[1],alpha=True)
im.pixels.foreach_set(pixels.ravel());im.filepath_raw=str(P/'hair-chestnut.png');im.file_format='PNG';im.save();im.pack()
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);mat.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha'])
sc.frame_set(1)
sc['study']='8-second editable 3D portrait study. Existing photo-reconstructed face, MakeHuman CC0 shirt and Elvaerwyn CC-BY hair. Not an exact digital double.'
bpy.ops.wm.save_as_mainfile(filepath=str(P/'AI-Mentor-Portrait-Study.blend'),compress=True)
sc.render.filepath=str(P/'portrait-final.png');bpy.ops.render.render(write_still=True)
sc.frame_set(32);sc.render.filepath=str(P/'speech-final.png');bpy.ops.render.render(write_still=True)
sc.frame_set(1)
# Retain all facial controls in the editable .blend; export only the controls used in this test.
keep={'Basis','jawOpen','mouthStretchLeft','mouthStretchRight','mouthPressLeft','mouthPressRight','mouthFunnel','mouthPucker','mouthRollLower','eyeBlinkLeft','eyeBlinkRight','browInnerUp'}
for o in sc.objects:
 if o.type=='MESH' and o.data.shape_keys:
  for k in list(o.data.shape_keys.key_blocks):
   if k.name not in keep:o.shape_key_remove(k)
bpy.ops.object.select_all(action='DESELECT')
for o in sc.objects:
 if o.type in ['MESH','EMPTY']:o.select_set(True)
bpy.context.view_layer.objects.active=bpy.data.objects['ReferenceWomanFace']
bpy.ops.export_scene.gltf(filepath=str(P/'portrait-study.glb'),export_format='GLB',use_selection=True,export_animation_mode='SCENE',export_animations=True,export_frame_range=True,export_anim_slide_to_zero=True,export_force_sampling=True,export_morph=True,export_yup=True,export_extras=True)
dest=P.parent.parent/'frontend/public/avatars/portrait-study';dest.mkdir(parents=True,exist_ok=True)
for name in ['portrait-study.glb','kim-preview.wav','portrait-final.png']:
 shutil.copy2(P/name,dest/name)
shutil.copy2('/Users/asminauldaseva/Downloads/ии модель ai модель.jpg',dest/'reference.jpg')
print('STUDY_EXPORTED',flush=True)
