"""Editorial stills of Alex for the presentation: pale cool backdrop, soft light,
shallow depth of field.
  Blender -b <clip>-video.blend --python pres_render.py -- <out.png> <frame> <shot>
shot: hero (waist-up, hand in focus), hands (close on the hands), face (close portrait)
"""
import bpy, sys, math
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
out, frame, shot = args[0], int(args[1]), args[2]
sc = bpy.context.scene
sc.frame_set(frame)
bpy.context.view_layer.update()
sc.render.engine = "BLENDER_EEVEE_NEXT"
sc.render.resolution_x, sc.render.resolution_y = (1920, 1080) if shot != "face" else (1400, 1400)
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium Low Contrast"
world = sc.world or bpy.data.worlds.new("w")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.62, 0.70, 0.80, 1)
bg.inputs[1].default_value = 1.0

rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
pb = rig.pose.bones
P = "mixamorig:"
head = rig.matrix_world @ pb[P + "Head"].head
hand_r = rig.matrix_world @ pb[P + "RightHandMiddle1"].head
hand_l = rig.matrix_world @ pb[P + "LeftHandMiddle1"].head
hands = (hand_r + hand_l) / 2


def light(name, loc, energy, size, color):
    l = bpy.data.lights.new(name, "AREA")
    l.energy, l.size, l.color = energy, size, color
    o = bpy.data.objects.new(name, l)
    sc.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector((0, 0, head.z - 0.3)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


light("Key", (-1.8, -2.2, 2.6), 520, 3.0, (1.0, 0.97, 0.94))
light("Fill", (2.2, -1.6, 1.6), 240, 3.0, (0.86, 0.92, 1.0))
light("Rim", (0.6, 2.4, 2.4), 420, 2.0, (0.8, 0.88, 1.0))

cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
cam_data.dof.use_dof = True
if shot == "hero":
    focus = hand_r
    target = Vector((head.x - 0.36, 0, head.z - 0.22))
    cam.location = Vector((-0.45, -2.4, head.z - 0.02))
    cam_data.lens = 58
    cam_data.dof.aperture_fstop = 1.6
elif shot == "hands":
    focus = hands
    target = hands + Vector((0.0, 0, 0.02))
    cam.location = hands + Vector((-0.25, -0.95, 0.05))
    cam_data.lens = 85
    cam_data.dof.aperture_fstop = 1.4
else:
    focus = head + Vector((0, -0.08, 0.06))
    target = head + Vector((0, 0, 0.07))
    cam.location = head + Vector((0.18, -0.85, 0.08))
    cam_data.lens = 90
    cam_data.dof.aperture_fstop = 2.0
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
cam_data.dof.focus_distance = (focus - cam.location).length
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print("RENDERED", out, flush=True)
