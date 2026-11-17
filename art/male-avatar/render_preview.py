"""Preview renders of artyom.glb: full body, hand close-up, bent fingers."""
import sys, math
from pathlib import Path
import bpy
from mathutils import Vector, Euler
ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[-1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'frontend/public/avatars/male/artyom.glb'))
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 900, 1100
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.93, 0.94, 0.96, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.9
for loc, e in (((2, -3, 3), 3.5), ((-3, -2, 2), 2.0)):
    bpy.ops.object.light_add(type='SUN', location=loc); l = bpy.context.active_object; l.data.energy = e
    l.rotation_euler = (Vector((0, 0, 1.2)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add(); cam = bpy.context.active_object; sc.camera = cam
def shoot(name, target, dist, lens=50):
    cam.location = Vector(target) + Vector((0, -dist, 0.05))
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    sc.render.filepath = str(OUT / name); bpy.ops.render.render(write_still=True)
pb = {b.name.split(':')[-1]: b for b in arm.pose.bones}
shoot('artyom-full.png', (0, 0, 0.95), 4.2)
shoot('artyom-face.png', (0, -0.05, 1.6), 1.0, 70)
# Raise right hand in front of chest and bend fingers like letter А / point
for n, rot in (('RightArm', (0.0, 0, -0.9)), ('RightForeArm', (0, 0, -1.2))):
    pb[n].rotation_mode = 'XYZ'; pb[n].rotation_euler = rot
for f in ('Middle', 'Ring', 'Pinky'):
    for i in (1, 2, 3):
        b = pb['RightHand' + f + str(i)]; b.rotation_mode = 'XYZ'; b.rotation_euler = (1.2, 0, 0)
bpy.context.view_layer.update()
shoot('artyom-pose.png', (-0.15, -0.2, 1.25), 1.6, 50)
hand = arm.matrix_world @ pb['RightHandMiddle1'].head
shoot('artyom-hand.png', tuple(hand), 0.32, 50)
