"""Preview renders. Blender -b <file.blend> --python render.py -- <out_dir> [frame] [views]"""
import bpy, sys, math
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = Path(args[0] if args else "/tmp/avatar-renders")
out.mkdir(parents=True, exist_ok=True)
frame = int(args[1]) if len(args) > 1 else None
views = (args[2] if len(args) > 2 else "face,body").split(",")
sc = bpy.context.scene
if frame is not None:
    sc.frame_set(frame)
sc.render.engine = "BLENDER_EEVEE_NEXT"
sc.render.resolution_percentage = 100
sc.view_settings.view_transform = "AgX"
world = bpy.data.worlds.new("w") if not sc.world else sc.world
sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.82, 0.84, 0.87, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.7

def light(name, loc, energy, size=2.0):
    l = bpy.data.lights.get(name) or bpy.data.lights.new(name, "AREA")
    l.energy, l.size = energy, size
    o = bpy.data.objects.get(name) or bpy.data.objects.new(name, l)
    if o.name not in sc.collection.objects:
        sc.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector((0, 0, 1.4)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

light("Key", (1.6, -2.4, 2.4), 650)
light("Fill", (-2.0, -2.0, 1.6), 260)
light("Rim", (0.0, 2.5, 2.4), 300)

cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
head = None
for o in bpy.data.objects:
    if o.type == "ARMATURE" and "mixamorig:Head" in o.data.bones:
        head = (o.matrix_world @ o.data.bones["mixamorig:Head"].head_local).z
hz = head + 0.09 if head else 1.66
spec = {
    "face": ((0, -1.1, hz), (0, 0, hz - 0.02), 85, (900, 1100)),
    "bust": ((0, -1.9, hz - 0.3), (0, 0, hz - 0.33), 60, (900, 1100)),
    "body": ((0, -4.6, 1.05), (0, 0, 1.0), 50, (800, 1200)),
    "sign": ((0, -2.5, hz - 0.33), (0, 0, hz - 0.36), 50, (900, 1100)),
    "side": ((2.2, -1.3, hz - 0.33), (0, 0, hz - 0.36), 50, (900, 1100)),
}
for v in views:
    loc, target, lens, res = spec[v]
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    cam_data.lens = lens
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = str(out / f"{v}{'' if frame is None else '-' + str(frame)}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", sc.render.filepath, flush=True)
