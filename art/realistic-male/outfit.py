"""Stage 2: white shirt + black trousers, closed shirt front, narrow black tie,
darker hair, blue eyes. Input build/stage1.blend -> build/avatar.blend
  Blender -b art/realistic-male/build/stage1.blend --python art/realistic-male/outfit.py
"""
from pathlib import Path
import bpy, bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ART = Path(__file__).resolve().parent
BUILD = ART / "build"
DATA = Path(bpy.utils.extension_path_user("bl_ext.user_default.mpfb")) / "data"
P = "mixamorig:"
objs = {o.name: o for o in bpy.data.objects}
rig = objs["Avatar"]
body = objs["Avatar.body"]
suit = objs["Avatar.male_casualsuit01"]
hair = objs["Avatar.short02"]
eyes = objs["Avatar.high-poly"]
bones = rig.data.bones
z_of = lambda n: (rig.matrix_world @ bones[P + n].head_local).z


def images(obj):
    for slot in obj.material_slots:
        for node in slot.material.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image:
                yield slot.material, node


def diffuse(obj):
    for mat, node in images(obj):
        name = node.image.name.lower()
        if "normal" not in name and "_ao" not in name and "bump" not in name:
            return mat, node
    raise RuntimeError("no diffuse on " + obj.name)


def pixels(img):
    a = np.empty(img.size[0] * img.size[1] * 4, np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def new_image(name, arr):
    h, w = arr.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(arr.astype(np.float32).ravel())
    img.pack()
    return img


def luminance(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


# --- shirt / trousers: one garment, split at the waistband ------------------
mat, node = diffuse(suit)
src = pixels(node.image)
lum = luminance(src)
waist = z_of("Hips") + 0.075
me = suit.data
uv = me.uv_layers.active.data
top_uv = np.zeros(lum.shape, bool)
H, W = lum.shape
# Shirt and jeans are separate UV islands: split by island, not by height,
# so the waistband stays clean.
bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
uvl = bm.loops.layers.uv.active
key = lambda l: (round(l[uvl].uv.x, 5), round(l[uvl].uv.y, 5))
island = [-1] * len(bm.faces)
for f in bm.faces:
    if island[f.index] >= 0:
        continue
    stack, island[f.index] = [f], f.index
    while stack:
        g = stack.pop()
        for l in g.loops:
            for lo in l.edge.link_loops:
                h = lo.face
                if island[h.index] >= 0:
                    continue
                a = {key(l), key(l.link_loop_next)}
                b = {key(lo), key(lo.link_loop_next)}
                if a == b:
                    island[h.index] = f.index
                    stack.append(h)
zs = {}
for f in bm.faces:
    zc = sum((suit.matrix_world @ v.co).z for v in f.verts) / len(f.verts)
    zs.setdefault(island[f.index], []).append(zc)
top_island = {k: np.mean(v) > waist for k, v in zs.items()}
upper = [top_island[island[f.index]] for f in bm.faces]
for f, top in zip(bm.faces, upper):
    if top:
        for l in f.loops:
            u, v = l[uvl].uv
            top_uv[min(H - 1, max(0, int(v * H))), min(W - 1, max(0, int(u * W)))] = True
bm.free()
print("islands", len(zs), "shirt islands", sum(top_island.values()), flush=True)
# Normalise the fabric shading per garment so folds and seams survive recolouring.
def recolor(base, lo, hi, mask_lum):
    ref = np.percentile(mask_lum, 95) if mask_lum.size else 1
    shade = np.clip(lum / max(ref, 1e-3), 0, 1.15)
    out = src.copy()
    for c in range(3):
        out[..., c] = np.clip(lo[c] + (hi[c] - lo[c]) * shade, 0, 1)
    return out
shirt_img = new_image("shirt_white", recolor(None, (0.70, 0.71, 0.73), (0.97, 0.97, 0.98), lum[top_uv]))
pants_img = new_image("trousers_black", recolor(None, (0.008, 0.008, 0.01), (0.05, 0.05, 0.056), lum[~top_uv]))
shirt_mat = mat.copy(); shirt_mat.name = "Shirt"
pants_mat = mat.copy(); pants_mat.name = "Trousers"
for m, img in ((shirt_mat, shirt_img), (pants_mat, pants_img)):
    for n in m.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image == node.image:
            n.image = img
        if n.type == "BSDF_PRINCIPLED":
            n.inputs["Roughness"].default_value = 0.75 if m is shirt_mat else 0.85
me.materials.clear()
me.materials.append(shirt_mat)
me.materials.append(pants_mat)
for poly, top in zip(me.polygons, upper):
    poly.material_index = 0 if top else 1

# --- hair darker warm brown, eyes blue --------------------------------------
hmat, hnode = diffuse(hair)
hp = pixels(hnode.image)
target = np.array([0.15, 0.092, 0.052])
l = luminance(hp)[..., None]
hp[..., :3] = np.clip(target * (0.55 + 0.75 * l / max(np.percentile(l, 90), 1e-3)), 0, 1)
hnode.image = new_image("hair_brown", hp)
shoes = objs["Avatar.shoes02"]
smat, snode = diffuse(shoes)
sp = pixels(snode.image)
sl = luminance(sp)[..., None]
sp[..., :3] = np.clip(0.012 + 0.07 * sl / max(np.percentile(sl, 90), 1e-3), 0, 1)
snode.image = new_image("shoes_black", sp)
emat, enode = diffuse(eyes)
blue = bpy.data.images.load(str(DATA / "eyes/materials/blue_eye.png"))
blue.pack()
enode.image = blue

# --- surfaces for fitting the tie and the shirt front -----------------------
dg = bpy.context.evaluated_depsgraph_get()
shirt_bvh = BVHTree.FromObject(suit, dg)
body_bvh = BVHTree.FromObject(body, dg)


def front(bvh, x, z):
    hit = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)), 2.0)
    return hit[0].y if hit[0] else None


neck_z = z_of("Neck")
spine2_z = z_of("Spine2")
# Where the open collar is: shirt missing in front of the skin at x=0.
v_bottom = None
for z in np.arange(neck_z, spine2_z - 0.25, -0.005):
    s, b = front(shirt_bvh, 0.0, z), front(body_bvh, 0.0, z)
    if s is not None and (b is None or s < b - 0.002):
        v_bottom = z
        break
v_bottom = v_bottom if v_bottom is not None else spine2_z
print("V-neck from", round(v_bottom, 3), "to", round(neck_z, 3), flush=True)


def weights_for(z):
    # Blend Spine -> Spine1 -> Spine2 -> Neck by height (tie hangs with the torso).
    stops = [("Spine", z_of("Spine")), ("Spine1", z_of("Spine1")), ("Spine2", z_of("Spine2")), ("Neck", neck_z)]
    if z <= stops[0][1]:
        return {stops[0][0]: 1.0}
    for (a, za), (b, zb) in zip(stops, stops[1:]):
        if z <= zb:
            t = (z - za) / max(zb - za, 1e-6)
            return {a: 1 - t, b: t}
    return {"Neck": 1.0}


def make_object(name, verts, faces, material):
    m = bpy.data.meshes.new(name)
    m.from_pydata([tuple(v) for v in verts], [], faces)
    m.materials.append(material)
    for p in m.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, m)
    bpy.context.collection.objects.link(o)
    for vi, v in enumerate(verts):
        for b, w in weights_for(v[2]).items():
            g = o.vertex_groups.get(P + b) or o.vertex_groups.new(name=P + b)
            g.add([vi], w, "REPLACE")
    # Skin weights copied from the nearest body surface, so the piece moves
    # exactly like the shirt around it (height blending tore at the collar).
    for g in list(o.vertex_groups):
        o.vertex_groups.remove(g)
    for g in body.vertex_groups:
        if g.name.startswith(P):
            o.vertex_groups.new(name=g.name)
    bpy.context.view_layer.objects.active = o
    dt = o.modifiers.new("Weights", "DATA_TRANSFER")
    dt.object = body
    dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}
    dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"
    dt.layers_vgroup_select_dst = "NAME"
    with bpy.context.temp_override(object=o, active_object=o):
        bpy.ops.object.modifier_apply(modifier=dt.name)
    o.parent = rig
    mod = o.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    return o


# Shirt front: a white panel just behind the collar fills only the open V.
def opening(z):
    """Half-width of the collar opening at height z (shirt absent in front of skin)."""
    for x in np.arange(0.0, 0.09, 0.002):
        s_, b_ = front(shirt_bvh, x, z), front(body_bvh, x, z)
        if s_ is not None and (b_ is None or s_ < b_ - 0.002):
            return x
    return 0.09
top_v = neck_z - 0.03
rows = np.linspace(v_bottom - 0.015, top_v, 12)
verts, faces = [], []
cols = 7
for i, z in enumerate(rows):
    half = min(opening(z) + 0.012, 0.07)
    for j, x in enumerate(np.linspace(-half, half, cols)):
        b = front(body_bvh, x, z)
        y = (b if b is not None else -0.1) - 0.003
        verts.append((x, y, z))
for i in range(len(rows) - 1):
    for j in range(cols - 1):
        a = i * cols + j
        faces.append((a, a + 1, a + cols + 1, a + cols))
make_object("ShirtFront", verts, faces, shirt_mat)

# Narrow black tie: knot under the collar, blade down to the belt.
tie_mat = bpy.data.materials.new("Tie")
tie_mat.use_nodes = True
bsdf = tie_mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.006, 0.006, 0.008, 1)
bsdf.inputs["Roughness"].default_value = 0.42
bsdf.inputs["Specular IOR Level"].default_value = 0.6
top = neck_z - 0.012
tip = waist + 0.02
zs = np.linspace(top, tip, 26)
verts, faces = [], []
for i, z in enumerate(zs):
    t = (top - z) / (top - tip)
    if t < 0.1:
        half = 0.019 - 0.007 * t / 0.1  # knot
    else:
        half = 0.012 + 0.015 * (t - 0.1) / 0.9  # widens to the blade
    width_pts = [-half, 0.0, half]
    for x in width_pts:
        s = front(shirt_bvh, x, z)
        if s is None:
            s = front(body_bvh, x, z) or -0.12
        knot_out = 0.012 if t < 0.1 else 0.0
        verts.append((x, s - 0.005 - knot_out - 0.004 * (1 - abs(x) / max(half, 1e-6)), z))
n = len(zs)
for i in range(n - 1):
    a = i * 3
    faces.append((a, a + 1, a + 4, a + 3))
    faces.append((a + 1, a + 2, a + 5, a + 4))
# Pointed tip.
last = (n - 1) * 3
verts.append((0.0, verts[last + 1][1], tip - 0.03))
faces.append((last, last + 1, len(verts) - 1))
faces.append((last + 1, last + 2, len(verts) - 1))
tie = make_object("Tie", verts, faces, tie_mat)
sol = tie.modifiers.new("Thickness", "SOLIDIFY")
sol.thickness = 0.003
tie.modifiers.move(tie.modifiers.find("Thickness"), 0)

# Remove skin hidden under the clothes so it can never poke through.
suit_bvh = BVHTree.FromObject(suit, dg)
shoe_bvh = BVHTree.FromObject(objs["Avatar.shoes02"], dg)
# Final shape = basis + phenotype shape keys; read it with modifiers off so
# vertex indices still match the mesh.
saved = [(m, m.show_viewport) for m in body.modifiers]
for m, _ in saved:
    m.show_viewport = False
dg.update()
ev = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
final = [body.matrix_world @ v.co for v in ev.data.vertices]
for m, vis in saved:
    m.show_viewport = vis
assert len(final) == len(body.data.vertices)
bm = bmesh.new()
bm.from_mesh(body.data)
covered = set()
wrists = [rig.matrix_world @ bones[P + s + "Hand"].head_local for s in ("Left", "Right")]
for v in bm.verts:
    w = final[v.index]
    if w.z > neck_z - 0.025 or min((w - h).length for h in wrists) < 0.13:
        continue  # keep skin at the neck and under the cuffs (sleeves slide)
    near = suit_bvh.find_nearest(w)
    shoe = shoe_bvh.find_nearest(w)
    if (near[0] and near[3] < 0.025) or (shoe[0] and shoe[3] < 0.02):
        covered.add(v.index)
faces = [f for f in bm.faces if all(v.index in covered for v in f.verts)]
bmesh.ops.delete(bm, geom=faces, context="FACES_ONLY")
bm.to_mesh(body.data)
bm.free()
print("hidden skin faces", len(faces), flush=True)

# --- web-ready shape keys: bake the phenotype into the base shape, keep only
# the 52 ARKit face units (as morph targets the player drives from video).
from bl_ext.user_default.mpfb.services.faceservice import ARKIT_FACEUNITS
FACE = set(ARKIT_FACEUNITS)
def bake_keys(obj):
    keys = obj.data.shape_keys
    if not keys:
        return 0
    blocks = keys.key_blocks
    basis = blocks[0]
    n = len(obj.data.vertices)
    co = lambda kb: np.array([v.co for v in kb.data]).reshape(n, 3)
    b0 = co(basis)
    final = b0.copy()
    for kb in blocks[1:]:
        if kb.name not in FACE and kb.value:
            final += kb.value * (co(kb) - b0)
    deltas = {kb.name: co(kb) - b0 for kb in blocks[1:] if kb.name in FACE and np.abs(co(kb) - b0).max() > 1e-5}
    obj.shape_key_clear()
    for i, v in enumerate(obj.data.vertices):
        v.co = final[i]
    if not deltas:
        return 0
    obj.shape_key_add(name="Basis", from_mix=False)
    for name in ARKIT_FACEUNITS:
        if name in deltas:
            kb = obj.shape_key_add(name=name, from_mix=False)
            kb.data.foreach_set("co", (final + deltas[name]).ravel())
    return len(deltas)
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    print("face units", o.name, bake_keys(o), flush=True)

# Remove the helper geometry the Mask modifiers hid, then drop the masks
# (shape keys cannot be exported through modifiers).
grp = body.vertex_groups.get("body")
bm = bmesh.new(); bm.from_mesh(body.data)
dl = bm.verts.layers.deform.active
keep = set()
for v in bm.verts:
    if dl and grp.index in v[dl] and v[dl][grp.index] > 0.5:
        keep.add(v.index)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index not in keep], context="VERTS")
bm.to_mesh(body.data); bm.free()
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    for m in list(o.modifiers):
        if m.type == "MASK":
            o.modifiers.remove(m)
        elif m.type == "SOLIDIFY":
            with bpy.context.temp_override(object=o, active_object=o):
                bpy.ops.object.modifier_apply(modifier=m.name)
print("body vertices", len(body.data.vertices), flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BUILD / "avatar.blend"))
print("OUTFIT_DONE", "waist", round(waist, 3), "neck", round(neck_z, 3), flush=True)
