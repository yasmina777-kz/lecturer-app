Alphabet chart motion study — 2026-11-01

32 hand-authored alphabet clips use the user-supplied source-chart.jpg and
calibrated finger joints on the existing Mira rig. Ё has no source illustration
in that chart and keeps its existing video-based clip. This is animation authoring,
not training of an AI model, and not a certified RSL alphabet.

chart_poses.py defines finger shape, palm orientation and an approximate arrow
path for each letter. build_chart_motion.py bakes a relaxed start, quintic pose
transition, held handshape, arrow path where applicable and relaxed end. It uses
anatomical elbow IK, evaluated body clearance, quaternion hemisphere continuity
and whole-pose speed retiming. It stages GLBs/metadata/renders in candidate/.

Workflow (from project root):
1. Blender -b --python-exit-code 1 --python art/alphabet-cards/build_chart_motion.py
2. Inspect candidate renders against the chart, including angled views.
3. Blender -b --python-exit-code 1 --python art/sign-motion/verify_body_clearance.py
   -- anatomy directory=<absolute candidate path> report=<report.json>
4. Copy approved candidate GLBs/JSON into frontend/public/avatars/sign-motion.
5. python3 ml/rsl/publish_motion_catalog.py
6. Publish clearance validation with new exported-clip hashes; reuse old checks
   only for byte-identical unchanged clips and composed sequences.
7. npm run test:sign-motion --prefix frontend
   npm run build --prefix frontend

Every handshape is experimental-unreviewed. Drawings alone do not establish all
orientation, timing, contact or non-manual details of RSL. The geometry checks
cover joint limits and torso/head/clothing penetration, not semantic correctness,
all finger-to-finger contacts or arm-arm collisions. Compare linked human videos;
a qualified RSL reviewer is still needed before using these as authoritative lessons.

The browser shows a source card alongside the player. Letters open with the
full avatar ready to play from the beginning. Inspect letter pauses at the authored
pose and offers a hand close-up; Play the whole letter exits inspection and restarts.
