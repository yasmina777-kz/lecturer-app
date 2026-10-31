# Mira hand workshop

Build with Blender 4.5: `blender -b --python art/hand-rig/build.py`.
Validate/review: `blender -b --python art/hand-rig/validate.py -- render`.

Local editable output: `Mira-Hand-Workshop.blend`. Mesh coordinates, face, clothing and materials are unchanged. Repair isolates distal finger weights while preserving webbing blends; at most four normalized deform influences per hand vertex. The report records actual changes.

## Controls

In Pose Mode select `CTRL_LeftHand` or `CTRL_RightHand`, open Bone Properties → Custom Properties:

- `IK_FK`: 1 = move Hand target and Elbow pole; 0 = rotate `CTRL_FK_*` shoulder/forearm/wrist chain. Switching is a blend, not an automatic pose-snap operation.
- `curl`, `relax`, `spread`, `point`, `pinch`: coordinated hand controls.
- Each `CTRL_Left/Right{Thumb,Index,Middle,Ring,Pinky}1` has individual curl/spread and MCP/PIP/DIP adjustments. Thumb also has opposition.
- The original `mixamorig:*` deform names/rest transforms remain stable. Controllers are not deform bones.

The Action Editor contains five `TEST • …` baked actions. They key the armature's `controls_enabled` to 0. Clear the action and set `controls_enabled` to 1 to return to the editable controllers. Both IK and FK chains share the existing shoulder hierarchy. No Python driver namespace or frame-change handler is required on reopening the file.

## Game exports

`frontend/public/avatars/hand-workshop/mira-rig.glb` is the repaired skinned character without controllers. The five small animation-only GLBs share that skeleton, contain baked transforms, and work without Blender constraints. `grasp-scene.glb` is a self-contained character + stationary QA sphere + grasp animation. Metadata JSON files give actual exported durations/revisions.

The local platform preview is `/avatar-motion`. Existing sign sequences use the repaired character's weights; this does not replace sign animations with generic Mixamo Talking gestures. Existing Mixamo Standing Idle/Talking are available alongside the five independent mechanical tests. Flexion planes were calibrated from those downloaded motions; no new Mixamo download, recognition training or RSL translation is claimed.

Bone-tip contact fitting is followed by evaluated mesh contact checks in `validate.py`. The sphere remains stationary as a QA target. These are rig tests, not linguistically verified signs. Skin contact limits and control checks are in `validation.json`.

## Text → signs integration

`poses.py` is the shared source of open/closed/pinch mechanics for the workshop and the sign pipeline. Reviewed pointing handshapes use the workshop's folded fingers and solved thumb opposition. Captured signs retain their reference-specific shapes; a generic fist or Mixamo Talking clip is not substituted for them.

`art/sign-motion/retarget.py` records independent MCP flexion/spread, PIP/DIP flexion and thumb opposition, removes isolated tracking impulses, filters those anatomical coordinates symmetrically, and reconstructs finger chains before the final arm IK solve. This replaces quaternion averaging of finger roots, which could introduce unintended axial rotation. Explicit neutral endpoints prevent residual curl when joining words. The exporter receives a final integer-frame key so it cannot truncate the relaxed pose at a fractional action boundary. Shared whole-body retiming still limits rotation speed.

Rebuild all captured motions with `blender -b --python art/sign-motion/retarget.py`. Rebuild three older authored phrases with `blender -b --python art/sign-motion/repair_prepared.py`, then run `python3 ml/rsl/publish_motion_catalog.py`. The published catalog contains 33 letters, 170 words and three prepared phrases. Text/dictionary playback resolves all of them through that versioned catalog; old hardcoded animation fallbacks have been removed.

Checks: `blender -b --python art/hand-rig/check_sign_curves.py`, `npm run test:sign-motion --prefix frontend`, `npm run test:hand-workshop --prefix frontend`. These validate mechanical constraints, pose continuity and playback, not correctness of RSL grammar or every sign. Occluded reference fingers, body/clothing contact and facial grammar still need manual review; this change does not train a new AI model.
