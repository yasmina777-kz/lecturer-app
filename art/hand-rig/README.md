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
