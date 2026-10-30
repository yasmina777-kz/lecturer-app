AI Mentor — Mira, Blender gesture study v2

Open AI-Mentor-Mira.blend in Blender. Space plays frames 1–241 (8 seconds, 30fps).
Preview in the app: http://localhost:5173/gesture-preview
Browser asset: frontend/public/avatars/mira-blender/mira-signing.glb

This version uses a continuous human mesh and a 64-bone deform skeleton,
including three joints per finger, instead of the previous capsule-based avatar.
The gesture is authored and baked in Blender. The editable project includes
materials, packed textures, facial expression shape keys, lighting and camera.
The browser plays the same animation data with pause, scrub, speed and camera controls.

Source assets: local MakeHuman / MPFB base, system casualsuit02, ponytail01,
high-poly eyes, eyebrow001, eyelashes01 and expression units. These graphical
assets are CC0; the original source asset headers are retained in the local asset
library. The MPFB code is GPL and is used as a local authoring tool, not included
in the website runtime. No paid service or photo reconstruction is used here.
https://static.makehumancommunity.org/about/license.html

RSL reference: VOG “Давайте знакомиться!”, “Поговорим”, 00:17:
https://www.youtube.com/watch?v=XhfuzmNWmGA&t=17s
This is an authored animation study, not motion capture or verified RSL translation.
Hand shapes, timing and facial grammar still need review by a fluent RSL signer.
The model is not a photorealistic digital double. No speech/lip-sync is added in
this gesture-only sample. Existing lecture avatars are not replaced.

Rebuild: Blender -b --python build_model.py, then Blender -b --python animate.py.
The build script uses the existing local MakeHuman library path documented inside
it. The saved final .blend is self-contained and needs no MPFB installation to open.
