"""Export the web model (mesh + rig, no animation) with downsized textures.
  Blender -b art/realistic-male/build/avatar.blend --python art/realistic-male/export_model.py
"""
from pathlib import Path
import bpy, json

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend/public/avatars/alex"
OUT.mkdir(parents=True, exist_ok=True)
for img in bpy.data.images:
    if img.size[0] == 0:
        continue
    limit = 2048 if "skin" in img.name.lower() or "lightskinned" in img.name.lower() else 1024
    if max(img.size) > limit:
        s = limit / max(img.size)
        img.scale(int(img.size[0] * s), int(img.size[1] * s))
    if not img.packed_file:
        img.pack()
rig = bpy.data.objects["Avatar"]
rig.animation_data_clear()
for pb in rig.pose.bones:
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.location = (0, 0, 0)
bpy.ops.object.select_all(action="DESELECT")
for o in bpy.data.objects:
    if o.type in ("MESH", "ARMATURE"):
        o.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=str(OUT / "alex.glb"), export_format="GLB", use_selection=True, export_apply=True,
    export_animations=False, export_yup=True, export_image_format="AUTO", export_jpeg_quality=85,
    export_skins=True, export_morph=False,
)
# Alpha modes: Blender exports every MPFB material as BLEND, which breaks depth
# sorting in three.js (see-through skin, vanishing hair). Patch the GLB JSON.
import struct
glb = (OUT / "alex.glb").read_bytes()
jlen = struct.unpack("<I", glb[12:16])[0]
doc = json.loads(glb[20:20 + jlen])
for m in doc["materials"]:
    name = m.get("name", "")
    m.pop("extensions", None)
    if any(k in name for k in ("short02", "eyebrow", "eyelashes")):
        m["alphaMode"], m["alphaCutoff"] = "MASK", 0.35
    else:
        m.pop("alphaMode", None)
        m.pop("alphaCutoff", None)
        m["doubleSided"] = name in ("Shirt", "Trousers", "Tie")
doc.pop("extensionsUsed", None)
body = json.dumps(doc, separators=(",", ":")).encode()
body += b" " * (-len(body) % 4)
rest = glb[20 + jlen:]
out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(body) + len(rest)) + struct.pack("<I", len(body)) + b"JSON" + body + rest
(OUT / "alex.glb").write_bytes(out)
stats = {"objects": [o.name for o in bpy.data.objects if o.type == "MESH"],
         "vertices": sum(len(o.data.vertices) for o in bpy.data.objects if o.type == "MESH"),
         "bytes": (OUT / "alex.glb").stat().st_size}
print("EXPORTED", json.dumps(stats), flush=True)
