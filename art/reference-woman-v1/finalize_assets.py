import bpy,json,struct,shutil,math
from pathlib import Path
P=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(P/'AI-Mentor-Reference-Woman.blend'))
for m in bpy.data.materials:
 if any(n in m.name for n in ['Chestnut','Deep brown']):
  bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Anisotropic'].default_value=0;bs.inputs['Roughness'].default_value=.85;bs.inputs['Specular IOR Level'].default_value=.04
# Ensure the saved file opens at the start of the complete 45-second recording.
bpy.context.scene.frame_set(1)
assert bpy.context.scene.frame_end==1366
assert bpy.data.objects['ReferenceWomanFace'].data.shape_keys
for ob in bpy.data.objects:
 if ob.type=='MESH':
  for v in ob.data.vertices:assert all(math.isfinite(x) for x in v.co),ob.name
bpy.ops.wm.save_as_mainfile(filepath=str(P/'AI-Mentor-Reference-Woman.blend'))
# Change only hair material metadata in the already verified GLB; geometry/rig buffers are untouched.
path=P/'reference-woman.glb';b=path.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);rest=b[20+n:]
for m in j['materials']:
 if any(x in m.get('name','') for x in ['Chestnut','Deep brown']):
  m.get('extensions',{}).pop('KHR_materials_anisotropy',None)
  m['extensions']['KHR_materials_specular']['specularFactor']=.08
  m['pbrMetallicRoughness']['roughnessFactor']=.85
raw=json.dumps(j,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4)
path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(raw)+len(rest))+struct.pack('<I4s',len(raw),b'JSON')+raw+rest)
shutil.copy2(path,P.parent.parent/'frontend/public/avatars/live/reference-woman.glb')
print('VALIDATED',len(j['meshes']),'meshes',len(bpy.data.objects['AI_Mentor_Rig'].data.bones),'bones',len(bpy.data.sounds),'sound blocks')
