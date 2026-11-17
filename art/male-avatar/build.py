"""Build «Артём», a new male signing avatar, from scratch on the Mira skeleton.

Run (from the repository root):
  /Applications/Blender.app/Contents/MacOS/Blender -b --python art/male-avatar/build.py

Only the skeleton is taken from frontend/public/avatars/hand-workshop/mira-rig.glb
(70 Mixamo-named bones, same rest pose), so every existing sign clip plays on
the new body unchanged. All geometry is generated here:
  * body, limbs and every finger phalanx: skin-modifier tubes along the bones,
    subdivided; the palm is flattened along its real normal;
  * head with eyes, irises, brows, nose, ears, mouth and short hair;
  * T-shirt / jeans / shoes / skin materials assigned by body region;
  * skinning weights from distance to bone segments, restricted per finger
    chain so neighbouring fingers never pull each other.
Output: frontend/public/avatars/male/artyom.glb
"""
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'frontend/public/avatars/hand-workshop/mira-rig.glb'
OUT = ROOT / 'frontend/public/avatars/male/artyom.glb'
P = 'mixamorig:'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SRC))
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
for o in list(bpy.context.scene.objects):
    if o.type != 'ARMATURE':
        bpy.data.objects.remove(o, do_unlink=True)
arm.name = 'Artyom rig'
bones = {b.name[len(P):]: b for b in arm.data.bones}
H = lambda n: arm.matrix_world @ bones[n].head_local
T = lambda n: arm.matrix_world @ bones[n].tail_local

# ---------------------------------------------------------------- skeleton graph
verts, radii, edges = [], [], []


def v(p, r):
    verts.append(Vector(p))
    radii.append(r)
    return len(verts) - 1


def chain(points):
    ids = [v(p, r) for p, r in points]
    edges.extend(zip(ids, ids[1:]))
    return ids


# Torso / neck (centre line); front-back flattening happens after skinning.
pelvis = H('Hips') + Vector((0, 0.005, 0))
torso = chain([
    (pelvis + Vector((0, 0, -0.035)), 0.150),
    (pelvis + Vector((0, 0, 0.04)), 0.158),
    ((H('Spine') + H('Spine1')) / 2, 0.142),
    (H('Spine2'), 0.152),
    (H('Spine2').lerp(H('Neck'), .5) + Vector((0, 0, 0)), 0.170),
    (H('Neck') + Vector((0, 0, -0.035)), 0.150),
    (H('Neck'), 0.062),
    (H('Head') + Vector((0, 0, -0.01)), 0.055),
])
neck_top = torso[-1]
chest_top = torso[-3]

roots = []
limb = {}
for side, s in (('Left', 1), ('Right', -1)):
    # Shoulder girdle -> arm -> wrist
    a = chain([
        (H(side + 'Arm') + Vector((-s * 0.045, 0, 0.012)), 0.062),
        (H(side + 'Arm') + Vector((0, 0, 0.005)), 0.058),
        (H(side + 'Arm').lerp(H(side + 'ForeArm'), .5), 0.046),
        (H(side + 'ForeArm'), 0.039),
        (H(side + 'ForeArm').lerp(H(side + 'Hand'), .45), 0.037),
        (H(side + 'Hand'), 0.027),
        (H(side + 'Hand').lerp(sum((H(side + 'Hand' + f + '1') for f in ('Index', 'Middle', 'Ring', 'Pinky')), Vector()) / 4, .35), 0.024),
    ])
    edges.append((chest_top, a[0]))
    wrist = a[-2]
    knuckles = []
    for f, rs in (('Index', (0.0108, 0.0098, 0.0089, 0.0080)), ('Middle', (0.0112, 0.0101, 0.0091, 0.0082)),
                  ('Ring', (0.0106, 0.0096, 0.0087, 0.0078)), ('Pinky', (0.0095, 0.0086, 0.0078, 0.0071))):
        b1, b2, b3 = (side + 'Hand' + f + str(i) for i in (1, 2, 3))
        tip = T(b3) + (T(b3) - H(b3)).normalized() * 0.010
        ids = chain([(H(b1), rs[0] + 0.002), (H(b2), rs[1]), (H(b3), rs[2]), (T(b3), rs[3]), (tip, rs[3] * 0.82)])
        knuckles.append(ids[0])
        roots.append(ids[0])
    palm_c = v((H(side + 'Hand') * 0.45 + sum((verts[k] for k in knuckles), Vector()) / 4 * 0.55), 0.030)
    # Fingers and thumb are separate tubes rooted inside the solid palm hull
    # (built below); no tube webbing that could poke through the palm.
    t1, t2, t3 = (side + 'HandThumb' + str(i) for i in (1, 2, 3))
    ttip = T(t3) + (T(t3) - H(t3)).normalized() * 0.010
    th = chain([(H(t1).lerp(H(t2), .35), 0.0135), (H(t2), 0.0115), (H(t3), 0.0100), (T(t3), 0.0088), (ttip, 0.0074)])
    roots.append(th[0])
    limb[side] = dict(palm=palm_c, knuckles=knuckles)

    leg = chain([
        (H(side + 'UpLeg') + Vector((0, 0.005, 0.02)), 0.098),
        (H(side + 'UpLeg').lerp(H(side + 'Leg'), .45), 0.080),
        (H(side + 'Leg'), 0.056),
        (H(side + 'Leg').lerp(H(side + 'Foot'), .4), 0.058),
        (H(side + 'Foot') + Vector((0, 0, 0.01)), 0.042),
        (H(side + 'ToeBase') + Vector((0, 0.01, 0.015)), 0.045),
        (T(side + 'ToeBase') + Vector((0, 0.01, 0.02)), 0.037),
    ])
    edges.append((torso[0], leg[0]))

mesh = bpy.data.meshes.new('Artyom body')
mesh.from_pydata([tuple(p) for p in verts], edges, [])
body = bpy.data.objects.new('Artyom body', mesh)
bpy.context.collection.objects.link(body)
skin = body.modifiers.new('skin', 'SKIN')
skin.use_smooth_shade = True
skin.branch_smoothing = 0.6
for sv, r in zip(mesh.skin_vertices[0].data, radii):
    sv.radius = (r, r)
mesh.skin_vertices[0].data[torso[0]].use_root = True
for r in roots:
    mesh.skin_vertices[0].data[r].use_root = True
bpy.context.view_layer.objects.active = body
bpy.ops.object.modifier_apply(modifier='skin')

# Torso front-back depth (a body is not a cylinder) and flat palms.
spine_y = H('Spine2').y
for p in mesh.vertices:
    c = p.co
    if 0.80 < c.z < H('Neck').z - 0.02 and abs(c.x) < 0.22:
        c.y = spine_y + (c.y - spine_y) * 0.62
for side in ('Left', 'Right'):
    k = [verts[i] for i in limb[side]['knuckles']]
    w = H(side + 'Hand')
    normal = (k[0] - w).cross(k[3] - w).normalized()
    centre = verts[limb[side]['palm']]
    for p in mesh.vertices:
        d = p.co - centre
        if d.length < 0.055 and (p.co - w).length < 0.10:
            p.co = p.co - normal * d.dot(normal) * 0.42

# Solid palms: convex hull over knuckles and wrist, thick like a real hand.
palms = []
palm_keys = set()
for side in ('Left', 'Right'):
    k = [verts[i] for i in limb[side]['knuckles']]
    w = H(side + 'Hand')
    normal = (k[0] - w).cross(k[3] - w).normalized()
    across = (k[0] - k[3]).normalized()
    pts = []
    for q in k:
        for sgn in (1, -1):
            pts.append(q + normal * sgn * 0.0115)
    for off in (0.026, -0.024):
        for sgn in (1, -1):
            pts.append(w + across * off + normal * sgn * 0.0135 + (k[1] - w) * 0.08)
    tb = H(side + 'HandThumb2')
    for sgn in (1, -1):
        pts.append(w.lerp(tb, .6) + normal * sgn * 0.012)
    bm = bmesh.new()
    for q in pts:
        bm.verts.new(q)
    bmesh.ops.convex_hull(bm, input=bm.verts)
    me = bpy.data.meshes.new('palm')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('palm', me)
    bpy.context.collection.objects.link(o)
    sd = o.modifiers.new('sub', 'SUBSURF')
    sd.levels = 3
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='sub')
    palm_keys.update(tuple(round(c, 5) for c in (o.matrix_world @ q.co)) for q in me.vertices)
    palms.append(o)

bpy.context.view_layer.objects.active = body
sub = body.modifiers.new('sub', 'SUBSURF')
sub.levels = sub.render_levels = 2
bpy.ops.object.modifier_apply(modifier='sub')

# ---------------------------------------------------------------- head and face
def add(obj_op, name, loc, scale, **kw):
    obj_op(location=loc, **kw)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return o


eye_z = H('LeftEye').z
head_c = Vector((0, H('Head').y - 0.004, eye_z + 0.010))
HR = Vector((0.079, 0.094, 0.110))
parts = []
skull = add(bpy.ops.mesh.primitive_uv_sphere_add, 'head', head_c, tuple(HR), segments=64, ring_count=40)
for p in skull.data.vertices:  # squarer male jaw and a slight chin
    r = p.co - head_c
    if r.z < -0.02:
        f = min(1.0, (-0.02 - r.z) / 0.08)
        r.x *= 1.0 - 0.10 * f
        if r.y < 0:
            r.y *= 1.0 + 0.06 * f
        p.co = head_c + r
parts.append(skull)


def surface_y(x, z):
    """Front surface of the head ellipsoid at world x, z."""
    u = 1 - (x / HR.x) ** 2 - ((z - head_c.z) / HR.z) ** 2
    return head_c.y - HR.y * math.sqrt(max(u, 0.0))


for s in (1, -1):
    ex = 0.031 * s
    ey = surface_y(ex, eye_z) + 0.0085
    parts.append(add(bpy.ops.mesh.primitive_uv_sphere_add, 'eye', (ex, ey, eye_z), (0.0128, 0.0128, 0.0128), segments=24, ring_count=16))
    parts.append(add(bpy.ops.mesh.primitive_uv_sphere_add, 'iris', (ex, ey - 0.0118, eye_z), (0.0060, 0.0022, 0.0060), segments=20, ring_count=12))
    by = surface_y(ex * 1.05, eye_z + 0.022)
    parts.append(add(bpy.ops.mesh.primitive_uv_sphere_add, 'brow', (ex * 1.05, by - 0.001, eye_z + 0.022), (0.018, 0.0040, 0.0036), segments=16, ring_count=8))
    parts.append(add(bpy.ops.mesh.primitive_uv_sphere_add, 'ear', (s * 0.078, head_c.y + 0.012, eye_z - 0.008), (0.009, 0.019, 0.029), segments=16, ring_count=10))
nz = eye_z - 0.030
parts.append(add(bpy.ops.mesh.primitive_uv_sphere_add, 'nose', (0, surface_y(0, nz) - 0.006, nz), (0.010, 0.016, 0.020), segments=20, ring_count=12))
mz = eye_z - 0.060
parts.append(add(bpy.ops.mesh.primitive_uv_sphere_add, 'mouth', (0, surface_y(0, mz) + 0.001, mz), (0.020, 0.0045, 0.0038), segments=20, ring_count=10))
hair = add(bpy.ops.mesh.primitive_uv_sphere_add, 'hair', head_c + Vector((0, 0.004, 0.006)), (HR.x + 0.006, HR.y + 0.007, HR.z + 0.006), segments=64, ring_count=40)
bm = bmesh.new()
bm.from_mesh(hair.data)
hairline = eye_z + 0.040 - (head_c.z + 0.006)  # local z of the front hairline
cut = []
hair_c = head_c + Vector((0, 0.004, 0.006))
for f in bm.faces:
    c = f.calc_center_median() - hair_c
    front = c.y < -0.035
    side = abs(c.x) > 0.060
    if (front and c.z < hairline) or (side and c.z < 0.0 and c.y < 0.03) or c.z < -0.050:
        cut.append(f)
pass  # print('HAIR', len(bm.faces), 'cut', len(cut), 'hairline', round(hairline, 3), 'zrange', round(min(v.co.z for v in bm.verts), 3), round(max(v.co.z for v in bm.verts), 3), 'yrange', round(min(v.co.y for v in bm.verts), 3))
bmesh.ops.delete(bm, geom=cut, context='FACES')
bm.to_mesh(hair.data)
bm.free()
hair.modifiers.new('solid', 'SOLIDIFY').thickness = 0.005
bpy.context.view_layer.objects.active = hair
bpy.ops.object.modifier_apply(modifier='solid')
parts.append(hair)
parts.extend(palms)

# ---------------------------------------------------------------- materials
def mat(name, rgb, rough=0.6, sheen=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    return m


M = dict(skin=mat('skin', (0.80, 0.58, 0.46), 0.55), shirt=mat('t-shirt', (0.11, 0.26, 0.45), 0.85),
         jeans=mat('jeans', (0.13, 0.15, 0.22), 0.9), shoes=mat('shoes', (0.06, 0.06, 0.07), 0.5),
         eye=mat('eye white', (0.93, 0.93, 0.91), 0.25), iris=mat('iris', (0.10, 0.07, 0.05), 0.2),
         hair=mat('hair', (0.08, 0.055, 0.04), 0.7), lips=mat('lips', (0.62, 0.35, 0.32), 0.5))
for o, key in ((p, {'eye': 'eye', 'iris': 'iris', 'brow': 'hair', 'hair': 'hair', 'mouth': 'lips'}.get(p.name.split('.')[0], 'skin'))
               for p in parts):
    o.data.materials.append(M[key])

body.data.materials.clear()
for k in ('skin', 'shirt', 'jeans', 'shoes'):
    body.data.materials.append(M[k])


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
    return (p - (a + ab * t)).length, t


upper_arm = {s: (H(s + 'Arm'), H(s + 'ForeArm')) for s in ('Left', 'Right')}
for poly in body.data.polygons:
    c = poly.center
    idx = 0
    if c.z < 0.115:
        idx = 3
    elif c.z < H('Hips').z + 0.05 and abs(c.x) < 0.30:
        idx = 2
    elif H('Hips').z + 0.05 <= c.z < H('Neck').z - 0.025 and abs(c.x) < 0.20:
        idx = 1
    for s in ('Left', 'Right'):
        d, t = seg_dist(c, *upper_arm[s])
        if d < 0.07 and t < 0.48:
            idx = 1
        if (c - (H(s + 'Arm') + Vector(((1 if s == 'Left' else -1) * -0.03, 0, 0.0)))).length < 0.075:
            idx = 1
    poly.material_index = idx

# ---------------------------------------------------------------- join + skinning
for o in bpy.context.scene.objects:
    o.select_set(False)
for o in parts + [body]:
    o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body.name = 'Artyom'

DEFORM = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']
for s in ('Left', 'Right'):
    DEFORM += [s + n for n in ('Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase')]
    DEFORM += [s + 'Hand' + f + str(i) for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky') for i in (1, 2, 3)]
groups = {n: body.vertex_groups.new(name=P + n) for n in DEFORM}
segs = {n: (H(n), T(n)) for n in DEFORM}
# Fingertips extend past the last bone tail.
for s in ('Left', 'Right'):
    for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky'):
        n = s + 'Hand' + f + '3'
        segs[n] = (H(n), T(n) + (T(n) - H(n)) * 0.8)


def finger_of(n):
    for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky'):
        if f in n:
            return n[:n.index(f) + len(f)]
    return None


head_parts_z = H('Head').z - 0.005
for p in body.data.vertices:
    c = p.co
    if tuple(round(q, 5) for q in c) in palm_keys:
        side = 'Left' if c.x > 0 else 'Right'
        groups[side + 'Hand'].add([p.index], 1.0, 'REPLACE')  # the palm is rigid
        continue
    if c.z > head_parts_z + 0.02 and abs(c.x) < 0.11:
        groups['Head'].add([p.index], 1.0, 'REPLACE')
        continue
    d = {n: seg_dist(c, *segs[n])[0] for n in DEFORM}
    near = min(d, key=d.get)
    fing = finger_of(near)
    if fing:
        side = 'Left' if near.startswith('Left') else 'Right'
        cand = [fing + str(i) for i in (1, 2, 3)] + [side + 'Hand']
        if near.endswith('1') and (c - H(near)).length < 0.014 and 'Thumb' not in near:
            # knuckle: blend into the rigid palm so the seam cannot tear
            t = (c - H(near)).length / 0.014
            groups[near].add([p.index], 0.35 + 0.65 * t, 'REPLACE')
            groups[side + 'Hand'].add([p.index], 0.65 - 0.65 * t, 'REPLACE')
            continue
    elif near.endswith('Hand'):
        side = near[:-4]
        cand = [near, side + 'ForeArm'] + [side + 'Hand' + f + '1' for f in ('Index', 'Middle', 'Ring', 'Pinky', 'Thumb')]
    elif abs(c.x) < 0.165 and H('Hips').z - 0.02 < c.z < H('Neck').z:
        # Torso skin follows the spine and collar bones, never the upper arm
        # (otherwise raising an arm pulls a bulge out of the chest).
        torso_bones = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'LeftShoulder', 'RightShoulder']
        cand = sorted(torso_bones, key=d.get)[:3]
    else:
        cand = sorted(d, key=d.get)[:3]
        cand = [n for n in cand if not finger_of(n)] or [near]
    w = {n: 1.0 / (d[n] + 0.006) ** 4 for n in cand}
    top = sorted(w, key=w.get, reverse=True)[:3]
    tot = sum(w[n] for n in top)
    for n in top:
        if w[n] / tot > 0.02:
            groups[n].add([p.index], w[n] / tot, 'REPLACE')

print('PALM verts', sum(1 for p in body.data.vertices if tuple(round(q, 5) for q in p.co) in palm_keys))
body.parent = arm
mod = body.modifiers.new('rig', 'ARMATURE')
mod.object = arm
bpy.ops.object.shade_smooth()

OUT.parent.mkdir(parents=True, exist_ok=True)
for o in bpy.context.scene.objects:
    o.select_set(o in (arm, body))
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', use_selection=True,
                          export_animations=False, export_skins=True, export_yup=True)
print('EXPORTED', OUT, len(body.data.vertices), 'verts')
