# «Алекс» — realistic signing avatar

MPFB 2 (MakeHuman for Blender) body with CC0 MakeHuman assets, MPFB's Mixamo rig (52 bones, every finger
phalanx, real skin weights). Original character: brown swept-up hair, blue eyes, white shirt, narrow black tie,
black trousers. Not a likeness of a real person.

Needs Blender 4.5 with the MPFB extension and the MakeHuman system asset pack in MPFB's user data folder
(`~/Library/Application Support/Blender/4.5/extensions/.user/user_default/mpfb/data`).

```sh
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b --python art/realistic-male/build.py                                   # body, hair, clothes, rig
$B -b art/realistic-male/build/stage1.blend --python art/realistic-male/outfit.py   # white shirt, tie, hidden skin
$B -b art/realistic-male/build/avatar.blend --python art/realistic-male/export_model.py  # frontend/public/avatars/alex/alex.glb
for i in 0 1 2; do BATCH=$i/3 $B -b --python art/realistic-male/retarget.py -- all & done; wait
python3 art/realistic-male/build_catalog.py
$B -b art/realistic-male/build/<clip>.blend --python art/realistic-male/render.py -- <out> <frame> bust,side,sign
```

## Motion from video (main path)

`ml/rsl/capture_motion.py` runs MediaPipe Pose (full) + Hand Landmarker on every dictionary video (578 words +
33 letters) and stores world landmarks. `solve_video.py` drives Alex's skeleton straight from them:
arm directions with the avatar's own bone lengths, elbow plane twist, forearm pronation share, palm frame,
and fingers with human joint ranges (MCP ≤90°, PIP ≤105°, DIP ≤80°, per-finger spread limits), neighbour
fingers that cannot sweep past each other and a spread that closes in a fist. Landmarks are smoothed,
short gaps filled, and every clip eases from/to one relaxed pose. `solve_video.py -- idle` writes the
breathing idle clip.

```sh
cd ml/rsl && .venv/bin/python capture_motion.py
for i in 0 1 2; do BATCH=$i/3 $B -b art/realistic-male/build/avatar.blend --python art/realistic-male/solve_video.py -- all & done; wait
$B -b art/realistic-male/build/avatar.blend --python art/realistic-male/solve_video.py -- idle
python3 art/realistic-male/build_catalog.py
```

`retarget.py` (older path) transfers world bone directions, palm frames and finger curl (never raw local rotations), so the
207 saved signs play on Alex's own rest pose. The player offers «Видео / Аватар»; signs without a saved motion
fall back to the signer videos. Known limits: no facial animation or mouthing, finger contacts not solved,
no linguistic review of the retargeted motion yet.
