# Mixamo trial — Mira

`prepare.py` exports a neutral copy of the existing avatar, without changing any platform asset. Run with Blender 4.5:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python art/mixamo-trial/prepare.py
```

Local outputs (ignored in Git):
- `AI-Mentor-Mira-Mixamo.fbx`: existing 64-bone skeleton, 30 finger joints, 6 meshes, textures embedded, no animation. FBX round-trip validation passed.
- `AI-Mentor-Mira-AutoRig.fbx`: neutral mesh-only fallback for Mixamo auto-rigging.
- `validation.json`: local export checks. Mixamo acceptance was subsequently confirmed (see below).

The rigged export was accepted by Mixamo on 2026-10-30 using the user's Adobe account. Two animations were downloaded: Standing Idle and Talking (Asking A Question With Two Hands), FBX Binary, 30 fps, Without Skin, no keyframe reduction. Original FBX files remain local/ignored.

`import_motion.py -- /absolute/path/to/Talking.fbx` retargets one downloaded clip. It handles Mixamo's normalized T bind pose by transferring posed bone axes to the existing A-pose rig while preserving connected target offsets; applying a T-to-pose delta onto the A bind pose is incorrect. The six forearm skin helpers follow the source forearm. Output is animation-only GLB plus metadata under `frontend/public/avatars/mixamo-trial`. A local `.blend` review project is also saved.

Preview: http://localhost:5173/avatar-motion . The two examples use the existing avatar mesh and offer full-body view, hand close-up, angle, speed, pause, seek and repeat. They do not alter lesson motions.

Validate: `node frontend/scripts/check-mixamo-motion.mjs` and `npm run build --prefix frontend`.
Mixamo motions are a trial for body movement, not verified RSL gestures. Do not layer arbitrary hand/arm motion over signing or replace the sign library with generic conversational gestures. Exact hand shapes, contacts and non-manual markers still need signer review.

Adobe references:
- https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- https://helpx.adobe.com/creative-cloud/help/mixamo-rigging-animation.html

Source character: the existing MakeHuman CC0 Mira base; see `art/mira-blender-v2/README.txt`. The generated application clips are attributed in `frontend/public/avatars/mixamo-trial/ATTRIBUTION.txt`.

Integrated playback (`/text-to-sign`, dictionary and captured-letter exercises):
- `SignSequencePlayer` uses the same Mira skeleton for both sources. `AvatarPlayback` plays Standing Idle before/after a request and blends through the neutral lead-in in 350 ms.
- Meaningful sign poses receive zero idle contribution; pause/scrub uses exact source transforms. Seeking to a word beyond the lead-in selects its exact pose immediately. Talking remains in the separate body-motion trial only.
- Single Cyrillic characters automatically select the alphabet. A sentence beginning with «Я» still uses word signs. All 33 letters are checked against catalog IDs.
- Unsupported tokens block the full phrase; they are never silently skipped or replaced by arbitrary body gestures.
- This integration does not train a text-to-RSL model. Selection uses the local dictionary and word forms; the existing camera classifier is a separate AI component. No inference API key is required. Gesture and grammar correctness still needs RSL signer validation.

Additional regression check: `node frontend/scripts/check-avatar-playback.mjs` (exclusive motion weights, exact pause/seek/resume poses, empty state and word jumps).
