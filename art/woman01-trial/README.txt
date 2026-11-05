Woman 01: colored, rigged comparison candidate — 2026-11-05

Source: user-supplied Woman_01.blend. Always opened with --disable-autoexec.
The supplied file and the current production avatar are not overwritten.

Original audit
- Static T-pose, one fused mesh, 469,893 vertices / 939,814 polygons.
- No armature, weights, controls or animations.
- Four unpacked external texture maps were missing. See inspect_model.py.

Implemented
- Mesh reduced to 84,569 vertices (GLB splits vertices at attribute boundaries).
- Deform rig: 51 bones including all 30 finger segments, normalized top-four
  skin weights, matching the naming convention used by the existing player.
- New skin, dark-brown hair, facial paint and navy/gray clothing colors,
  embedded in GLB vertex colors. These are not restored original textures.
  The face geometry is preserved. Paint is approximate, particularly near
  the hairline and collar; it is not a photorealistic replacement texture.
- 207 existing catalogue animations retargeted to this rig's own rest axes
  and proportions, plus five mechanical studies (fist, point, pinch, wave,
  grasp). Actions are baked at 30 fps without Blender controller dependencies.
- Each source motion remains available for comparison. The new avatar has
  a dedicated authenticated /avatar-woman page linked from text-to-sign.
  It supports the catalogue, text sequences, alphabet and camera controls.
- The default avatar and the recognition/training models are unchanged.

Validation
- check_export.py checks finite model/animation values, normalized skin
  weights and quaternions, binding of all 153 channels to the 51 target bones,
  matching clip durations and all 33 letters in the 212-entry catalogue.
- Frontend TypeScript/Vite build passed. Browser preview confirmed embedded
  colors and playback of the greeting; letter preview and zoom were tested.
- Front/angled Blender renders inspected the greeting and hand studies.

Remaining limitations
- This is a comparison trial, not a validated replacement for the main avatar.
- Retargeting is not sign-language training or linguistic validation.
- Tight fist closure and thumb/finger contact still need manual pose/weight
  refinement for these proportions. The source model has fused geometry,
  no separate eyeballs and limited joint topology.
- No guarantee of collision-free fingers/body across the full catalogue.
- Mechanical grasp study has no fitted object/contact solver yet. This rig
  has deform bones, not a full animator-facing IK/FK control rig.

Reproduction (Blender 4.5.3 LTS)
1. blender -b --disable-autoexec /path/Woman_01.blend --python art/woman01-trial/build_rig.py
2. blender -b --disable-autoexec --python art/woman01-trial/retarget.py -- all
3. Repeat retarget.py with paths to the five hand-workshop GLBs.
4. python3 art/woman01-trial/build_catalog.py
5. python3 art/woman01-trial/check_export.py
6. cd frontend && npm run build

Intermediate .blend files/renders remain local and ignored. Web assets and
reproduction scripts are committed. The separately delivered colored .blend
contains the greeting animation and opens with vertex colors enabled.
