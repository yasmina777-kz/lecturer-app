AI Mentor — Mira / soft motion study

AI-Mentor-Mira-Soft-Motion.blend: editable Blender scene, frames 1–241, 30fps.
Preview: http://localhost:5173/gesture-preview
Export: frontend/public/avatars/mira-blender/mira-signing-soft.glb

Changes from v2:
- Each finger and phalanx has its own closure/opening timing and flexion plane.
- Relaxed resting fingers and thumb opposition instead of a flat open hand.
- Curved reaches, asymmetric hand timing, delayed wrist rotation and gentle release.
- Chest, clavicle, neck and gaze participate in the movement.
- Six forearm roll bones distribute twisting through the skin.
- A wrist bend limit prevents extreme wrist angles in transitions.
- Fingertip contact is reconciled with the bend limit during the held gesture.
- Quaternion signs remain continuous across the baked frame samples.

Uses the existing CC0 MakeHuman model from ../mira-blender-v2/Mira-base.blend.
Source, licensing and asset provenance: ../mira-blender-v2/README.txt.
This is an authored animation study, not motion capture or a verified RSL translation.
No claim of photorealism or linguistic validation is made.
Previous model and animation are retained in mira-blender-v2.

Build: Blender -b --python animate.py
Validate: Blender -b --python validate.py
The final .blend includes packed textures and does not require MPFB to open.
