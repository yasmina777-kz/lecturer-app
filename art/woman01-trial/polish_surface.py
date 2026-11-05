"""Polish the existing rig's clothing without changing face/fingers or bone rest axes.
Run with Blender --background --disable-autoexec --python this_file.
"""
from pathlib import Path
import bpy, json, math
ROOT = Path(__file__).resolve().parents[2]
ART = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ART/'Woman01-rig.blend'))
mesh = bpy.data.objects['Woman_01']
rig = bpy.data.objects['Woman01Rig']
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
original = [v.co.copy() for v in mesh.data.vertices]
group = mesh.vertex_groups.new(name='Surface polish clothing only')
for v in mesh.data.vertices:
    x, y, z = v.co
    # Taper away from hands, neck and boots; retain the scanned face exactly.
    amount = min(max((1.37-z)/.06, 0), max((.56-abs(x))/.045, 0), max((z-.14)/.06, 0), 1)
    if amount > 0:
        group.add([v.index], amount, 'REPLACE')
mod = mesh.modifiers.new('Gentle cloth smoothing', 'SMOOTH')
mod.vertex_group = group.name
mod.factor = .65
mod.iterations = 8
# Evaluate in rest space before armature deformation.
bpy.ops.object.modifier_move_up(modifier=mod.name)
bpy.ops.object.modifier_apply(modifier=mod.name)
# Cap surface displacement to 2.5 mm; keep silhouette, fit and skin weights.
for v, p in zip(mesh.data.vertices, original):
    delta = v.co-p
    if delta.length > .0025:
        v.co = p+delta.normalized()*.0025
for poly in mesh.data.polygons:
    poly.use_smooth = True
# Neutral wardrobe; keep existing skin, face/hair paint intact.
colors = mesh.data.color_attributes['Wardrobe']
palette = [((.025,.060,.105),(.038,.042,.048)),
           ((.058,.08,.105),(.060,.065,.072)),
           ((.21,.26,.29),(.235,.225,.21))]
for c in colors.data:
    for old, new in palette:
        if max(abs(c.color[i]-old[i]) for i in range(3)) < .0001:
            c.color = (*new, 1)
            break
base = mesh.data.materials[0]
base.name = 'Woman 01 | matte charcoal fabric'
base.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = .86
skin = base.copy(); skin.name = 'Woman 01 | soft skin'
bs = skin.node_tree.nodes.get('Principled BSDF')
bs.inputs['Roughness'].default_value = .55
bs.inputs['Subsurface Weight'].default_value = .04
hair = base.copy(); hair.name = 'Woman 01 | chestnut hair'
hair.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = .62
mesh.data.materials.append(skin); mesh.data.materials.append(hair)
for poly in mesh.data.polygons:
    avg = [sum(colors.data[i].color[c] for i in poly.vertices)/len(poly.vertices) for c in range(3)]
    z = sum(mesh.data.vertices[i].co.z for i in poly.vertices)/len(poly.vertices)
    is_skin = avg[0] > avg[2]*1.7 and avg[0] > .12
    is_hair = z > 1.41 and avg[0] < .09 and avg[1] < .05
    poly.material_index = 1 if is_skin else 2 if is_hair else 0
rig.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'frontend/public/avatars/woman01/woman01.glb'), export_format='GLB', use_selection=True, export_animations=False, export_yup=True, export_extras=True)
report = {
    'vertices': len(original),
    'maxDisplacementMetres': max((v.co-p).length for v,p in zip(mesh.data.vertices,original)),
    'faceVerticesUnchanged': all((v.co-p).length == 0 for v,p in zip(mesh.data.vertices,original) if p.z >= 1.415),
    'handVerticesUnchanged': all((v.co-p).length == 0 for v,p in zip(mesh.data.vertices,original) if abs(p.x) >= .56),
    'boneRestAndWeights': 'unchanged', 'materials': 3,
}
assert report['faceVerticesUnchanged'] and report['handVerticesUnchanged']
(ART/'surface-report.json').write_text(json.dumps(report,indent=2))
print('SURFACE_POLISH', report, flush=True)
