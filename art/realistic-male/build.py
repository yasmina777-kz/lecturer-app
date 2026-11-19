"""Realistic male signing avatar built with MPFB 2 (MakeHuman for Blender, CC0 assets).

  /Applications/Blender.app/Contents/MacOS/Blender -b --python art/realistic-male/build.py

Look (not a copy of any real person): tall young man, brown swept-up hair,
blue eyes, white shirt with rolled sleeves, narrow black tie, black trousers,
black belt. The skeleton is MPFB's Mixamo rig (52 bones with every finger
phalanx and real skin weights), so the saved sign library retargets onto it.
Output: art/realistic-male/build/avatar.blend (input for retarget.py).
"""
from pathlib import Path
import bpy, bmesh, math
import numpy as np
from mathutils import Vector
from bl_ext.user_default.mpfb.services.humanservice import HumanService

ART = Path(__file__).resolve().parent
BUILD = ART / "build"
BUILD.mkdir(exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)

info = HumanService._create_default_human_info_dict()
info["phenotype"] = {
    "gender": 1.0, "age": 0.5, "muscle": 0.5, "weight": 0.45, "proportions": 0.6,
    "height": 0.55, "cupsize": 0.5, "firmness": 0.5,
    "race": {"asian": 0.0, "caucasian": 1.0, "african": 0.0},
}
info.update(
    rig="mixamo",
    eyes="high-poly/high-poly.mhclo",
    eyebrows="eyebrow001/eyebrow001.mhclo",
    eyelashes="eyelashes01/eyelashes01.mhclo",
    hair="short02/short02.mhclo",
    clothes=["male_casualsuit01/male_casualsuit01.mhclo", "shoes02/shoes02.mhclo"],
    skin_mhmat="young_caucasian_male/young_caucasian_male.mhmat",
    skin_material_type="MAKESKIN",
    eyes_material_type="MAKESKIN",
    alternative_materials={},
    name="Avatar",
)
settings = HumanService.get_default_deserialization_settings()
settings.update(subdiv_levels=0, override_skin_model="PRESET", override_rig="PRESET")
basemesh = HumanService.deserialize_from_dict(info, settings)

# 52 ARKit face units (MakeHuman faceunits01, CC0) for facial expression and mouth.
from bl_ext.user_default.mpfb.services.faceservice import FaceService
assert FaceService.is_faceunits01_installed(force_recheck=True), "faceunits01 pack missing"
FaceService.load_targets(basemesh, load_microsoft_visemes=False, load_meta_visemes=False, load_arkit_faceunits=True)
FaceService.interpolate_targets(basemesh)
print("SHAPEKEYS", {o.name: len(o.data.shape_keys.key_blocks) for o in bpy.data.objects if o.type == "MESH" and o.data.shape_keys}, flush=True)
print("FACEKEYS", [k.name for k in basemesh.data.shape_keys.key_blocks][-6:], flush=True)
rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
print("OBJECTS", [(o.name, o.type, len(o.data.vertices) if o.type == "MESH" else 0) for o in bpy.data.objects], flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BUILD / "stage1.blend"))
print("STAGE1_DONE", flush=True)
