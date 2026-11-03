"""Fit the local CC0 MakeHuman jeans outfit; preserve Mira's face/body/rig.
Run in Blender from the repository root. Only the clothing object is replaced.
"""
import bpy,sys,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SRC=Path('/Users/asminauldaseva/Documents/Codex/2026-10-16/new-chat-2/work/blender')
BUILD=ROOT/'art/mira-blender-v2/build_model.py'
# Recreate exactly the original shape solely to fit a garment. Never export this face.
source=BUILD.read_text().split('# Preserve expression deltas')[0]
source=source.replace('female_casualsuit02','female_casualsuit01')
# globals are required by the imported MPFB services.
__file__=str(BUILD)
exec(compile(source,str(BUILD),'exec'),globals())
cloth=assets['outfit']
bpy.context.view_layer.objects.active=cloth
for mod in list(cloth.modifiers):
 if mod.type=='SUBSURF':
  mod.show_viewport=True;mod.levels=max(1,mod.levels)
  bpy.ops.object.modifier_apply(modifier=mod.name)
for mod in list(cloth.modifiers):cloth.modifiers.remove(mod)
cloth.parent=None
cloth.name='Mira • tailored outfit'
bpy.data.libraries.write('/tmp/mira-fitted-jeans.blend',{cloth},fake_user=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/hand-rig/Mira-Hand-Workshop.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
body=bpy.data.objects['Mira • continuous human mesh']
def geom_hash(ob):
 return hashlib.sha256(b''.join(__import__('struct').pack('<3f',*v.co) for v in ob.data.vertices)).hexdigest()
face_before=geom_hash(body)
with bpy.data.libraries.load('/tmp/mira-fitted-jeans.blend',link=False) as (src,dst):dst.objects=['Mira • tailored outfit']
cloth=dst.objects[0];bpy.context.scene.collection.objects.link(cloth)
old=bpy.data.objects['Mira • outfit'];bpy.data.objects.remove(old,do_unlink=True)
cloth.name='Mira • outfit';cloth.parent=rig
mod=cloth.modifiers.new('Mira garment skin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True
# Use the asset's real fabric/seam normal map. No generated anatomy or face edits.
mat=bpy.data.materials.new('Mira • woven navy and denim');mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.86
base=SRC/'assets/clothes/female_casualsuit01'
for kind,socket in [('diffuse','Base Color'),('normal','Normal')]:
 tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(base/f'female_casualsuit01_{kind}.png'));tex.image.pack()
 if kind=='normal':
  tex.image.colorspace_settings.name='Non-Color';normal=mat.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.38
  mat.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color']);mat.node_tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
 else:mat.node_tree.links.new(tex.outputs['Color'],bs.inputs[socket])
cloth.data.materials.clear();cloth.data.materials.append(mat)
for p in cloth.data.polygons:p.material_index=0;p.use_smooth=True
# Plain knit top keeps attention on the hands; denim retains seams and weave.
knit=bpy.data.materials.new('Mira • midnight knit');knit.use_nodes=True
knit_bs=knit.node_tree.nodes.get('Principled BSDF');knit_bs.inputs['Base Color'].default_value=(.025,.075,.09,1);knit_bs.inputs['Roughness'].default_value=.9
cloth.data.materials.append(knit)
# Disconnected garment components identify the shirt without a horizontal cut.
links={i:set() for i in range(len(cloth.data.vertices))}
for edge in cloth.data.edges:
 a,b=edge.vertices;links[a].add(b);links[b].add(a)
remaining=set(links)
while remaining:
 todo=[remaining.pop()];component=set(todo)
 while todo:
  for n in links[todo.pop()] & remaining:
   remaining.remove(n);component.add(n);todo.append(n)
 if sum(cloth.data.vertices[i].co.z for i in component)/len(component)>1.05:
  for polygon in cloth.data.polygons:
   if polygon.vertices[0] in component:polygon.material_index=1
# A small collar ease prevents the fitted shirt cutting into the clavicles.
for v in cloth.data.vertices:
 if v.co.z>1.4:
  v.co += v.normal * (.007 * min(1,(v.co.z-1.4)/.025))
cloth.data.update()
# Hide only skin covered by trousers, as a clothing mask would. Keep every
# vertex, facial material, shape key and skin weight unchanged.
mask=bpy.data.materials.get('Mira • skin under trousers') or bpy.data.materials.new('Mira • skin under trousers')
mask.use_nodes=True;mask.node_tree.nodes.clear();out=mask.node_tree.nodes.new('ShaderNodeOutputMaterial');bs=mask.node_tree.nodes.new('ShaderNodeBsdfPrincipled');bs.inputs['Alpha'].default_value=0
mask.node_tree.links.new(bs.outputs['BSDF'],out.inputs['Surface']);mask.surface_render_method='DITHERED'
if mask.name not in [m.name for m in body.data.materials]:body.data.materials.append(mask)
mi=list(body.data.materials).index(mask)
covered=set()
for v in body.data.vertices:
 upper=sum(g.weight for g in v.groups if any(n in body.vertex_groups[g.group].name for n in ['Hand','Arm','Shoulder','Head','Neck']))
 if v.co.z<1.0 and upper<.05:covered.add(v.index)
for polygon in body.data.polygons:
 if polygon.material_index==mi:polygon.material_index=0
 if all(i in covered for i in polygon.vertices):polygon.material_index=mi
assert geom_hash(body)==face_before
report={'bodyAndFaceGeometryUnchanged':True,'bodyGeometrySha256':face_before,'clothing':'CC0 MakeHuman female_casualsuit01, original fitted macro shape','faceMaterialsUntouched':True}
(ROOT/'docs/avatar-outfit-check.json').write_text(json.dumps(report,indent=2))
# Editable source retains controllers. Export a controller-free rest skeleton.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/hand-rig/Mira-Hand-Workshop.blend'),compress=True)
rig.animation_data_clear();rig['controls_enabled']=0
for ob in [rig,*rig.children_recursive]:ob.animation_data_clear()
for b in rig.pose.bones:
 for c in list(b.constraints):b.constraints.remove(c)
 b.matrix_basis.identity()
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for bone in list(rig.data.edit_bones):
 if bone.name.startswith('CTRL_'):rig.data.edit_bones.remove(bone)
bpy.ops.object.mode_set(mode='OBJECT')
for ob in rig.children_recursive:
 if ob.type=='MESH':ob.select_set(True)
bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=str(ROOT/'frontend/public/avatars/hand-workshop/mira-rig.glb'),export_format='GLB',use_selection=True,export_animations=False)
print('OUTFIT_UPDATED',report)
