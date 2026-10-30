"""Export a neutral copy of Mira for a Mixamo trial; never modify app assets."""
from pathlib import Path
import bpy,json
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/mira-blender-v2/Mira-base.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
meshes=[o for o in rig.children_recursive if o.type=='MESH']
for ob in [rig,*meshes]:
 ob.animation_data_clear()
 if ob.type=='MESH' and ob.data.shape_keys:
  ob.data.shape_keys.animation_data_clear()
  for key in ob.data.shape_keys.key_blocks:key.value=0
for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
rig.data.pose_position='REST'
bpy.context.view_layer.update()
# Keep our platform's blue outfit, with no cameras, lights or animation exported.
outfit=bpy.data.objects.get('Mira • outfit')
if outfit:
 mat=bpy.data.materials.new('Mentor blue');mat.use_nodes=True
 bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.065,.12,.18,1);bs.inputs['Roughness'].default_value=.87
 outfit.data.materials.clear();outfit.data.materials.append(mat)
 for face in outfit.data.polygons:face.material_index=0
textures=OUT/'textures';textures.mkdir(exist_ok=True)
for i,img in enumerate(bpy.data.images):
 if img.type!='IMAGE' or not img.has_data:continue
 img.filepath_raw=str(textures/f'texture-{i}.png');img.file_format='PNG';img.save()
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for mesh in meshes:mesh.select_set(True)
bpy.context.view_layer.objects.active=rig
rigged=OUT/'AI-Mentor-Mira-Mixamo.fbx'
bpy.ops.export_scene.fbx(filepath=str(rigged),use_selection=True,object_types={'ARMATURE','MESH'},add_leaf_bones=False,bake_anim=False,path_mode='COPY',embed_textures=True,axis_forward='-Z',axis_up='Y',use_armature_deform_only=False)
expected=set(b.name for b in rig.data.bones)
# Also keep a mesh-only upload for Mixamo auto-rigging if it rejects the existing rig.
for mesh in meshes:
 world=mesh.matrix_world.copy();mesh.parent=None;mesh.matrix_world=world
 for mod in list(mesh.modifiers):
  if mod.type=='ARMATURE':mesh.modifiers.remove(mod)
rig.select_set(False)
bpy.ops.export_scene.fbx(filepath=str(OUT/'AI-Mentor-Mira-AutoRig.fbx'),use_selection=True,object_types={'MESH'},bake_anim=False,path_mode='COPY',embed_textures=True,axis_forward='-Z',axis_up='Y')
# Round-trip the main FBX before asking Mixamo to process it.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(rigged))
loaded=next(o for o in bpy.data.objects if o.type=='ARMATURE')
actual=set(b.name for b in loaded.data.bones)
assert expected<=actual,(expected-actual)
for side in ['Left','Right']:
 for finger in ['Thumb','Index','Middle','Ring','Pinky']:
  for joint in [1,2,3]:assert 'mixamorig:'+side+'Hand'+finger+str(joint) in actual
assert not bpy.data.actions
report={'file':rigged.name,'bones':len(actual),'meshes':sum(o.type=='MESH' for o in bpy.data.objects),'fingerJoints':30,'animation':False,'roundTrip':'passed','mixamoUpload':'not yet tested'}
(OUT/'validation.json').write_text(json.dumps(report,indent=2))
print('MIXAMO_EXPORT_READY',json.dumps(report),flush=True)
