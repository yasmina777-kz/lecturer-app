"""Read-only geometry/rig audit and clay previews of the user-supplied model.

Run Blender with --background --disable-autoexec <source.blend> --python
this_script.py -- <output_directory>. Never saves over the source file.
"""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

out = Path(sys.argv[sys.argv.index('--') + 1])
out.mkdir(parents=True, exist_ok=True)
model = bpy.data.objects['Woman_01']
rigs = [o for o in bpy.data.objects if o.type == 'ARMATURE']
report = {
    'source': Path(bpy.data.filepath).name,
    'vertices': len(model.data.vertices),
    'polygons': len(model.data.polygons),
    'armatures': len(rigs),
    'bones': sum(len(o.data.bones) for o in rigs),
    'vertexGroups': len(model.vertex_groups),
    'actions': len(bpy.data.actions),
    'textures': [
        {'name': i.name, 'packed': bool(i.packed_file),
         'available': bool(i.packed_file) or Path(bpy.path.abspath(i.filepath)).is_file()}
        for i in bpy.data.images if i.source == 'FILE'
    ],
    'preview': 'Neutral clay material; original texture files are not embedded.',
}
(out / 'audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
for o in bpy.data.objects:
    o.hide_render = o != model
model.hide_render = False
material = bpy.data.materials.new('Trial clay (not original appearance)')
material.use_nodes = True
shader = material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = (0.38, 0.46, 0.55, 1)
shader.inputs['Roughness'].default_value = 0.75
model.data.materials.clear()
model.data.materials.append(material)
for face in model.data.polygons:
    face.material_index = 0

points = [model.matrix_world @ Vector(c) for c in model.bound_box]
low = Vector([min(p[i] for p in points) for i in range(3)])
high = Vector([max(p[i] for p in points) for i in range(3)])
center = (low + high) * 0.5
size = max(high - low)
scene = bpy.context.scene
scene.use_nodes = False
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new('Trial studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.7, 0.75, 0.85, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.5
for name, offset, energy in [
    ('Key', (2, -2, 3), 250), ('Fill', (1, 2, 1), 100),
]:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy = energy * size * size
    light.shape = 'DISK'
    light.size = size * 2
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.location = center + Vector(offset) * size
    obj.rotation_euler = (center - obj.location).to_track_quat('-Z', 'Y').to_euler()
camera = bpy.data.objects.new('Trial camera', bpy.data.cameras.new('Trial camera'))
scene.collection.objects.link(camera)
scene.camera = camera
camera.data.type = 'ORTHO'
camera.data.ortho_scale = size * 1.2
for name, offset in [('front', (3, 0, 0.08)), ('three-quarter', (3, -1.5, 0.2))]:
    camera.location = center + Vector(offset) * size
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(out / f'{name}.png')
    bpy.ops.render.render(write_still=True)
print('TRIAL_AUDIT', json.dumps(report))
