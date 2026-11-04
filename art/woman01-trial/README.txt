Woman_01 candidate inspection — 2026-11-04

User-supplied Woman_01.blend was opened read-only with Blender 4.5.3 LTS
and --disable-autoexec. The file reports a newer Blender 5.0 version.
No source asset was overwritten and no production avatar was replaced.

Findings:
- T-pose clothed female character, with hands exposed.
- One character mesh: 469,893 vertices / 939,814 polygons.
- No armature, bones, vertex groups, modifiers or animation actions.
- Four external image files are missing and are not packed in the blend:
  Woman_01_basecolor.jpg, Woman_01_metallic.jpg,
  Woman_01_normal.jpg, Woman_01_roughness.jpg.
- Front and three-quarter clay previews inspect geometry only. Their
  neutral material is not the original character appearance.

Next integration requirements:
1. Obtain the texture folder (Woman_01.fbm) or a complete asset archive.
2. Prepare an optimized mesh retaining finger/joint topology.
3. Rig both arms, wrists and five fingers per hand, then skin the mesh.
4. Retarget selected motions with rest-axis correction and review thumb,
   finger flexion, wrist twist and body clearance before a catalogue rollout.
5. Export GLB and test in the web viewer before changing the active avatar.

The existing animation GLBs cannot be played on this unrigged mesh as-is.
This is a candidate audit, not a completed animation conversion.

Reproduce previews (output path may be outside the repository):
blender --background --disable-autoexec /path/to/Woman_01.blend \
  --python art/woman01-trial/inspect_model.py -- /path/to/output
