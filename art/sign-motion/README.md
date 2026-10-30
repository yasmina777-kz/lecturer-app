# Traceable reference-to-avatar motion

203 experimental clips cover the current 33 letters and 170-word dictionary. This does not mean the full language is covered or that the motions have been validated by signers.

## Pipeline

1. `ml/rsl/capture_motion.py` applies **pretrained** MediaPipe Hand Landmarker and Pose Landmarker to reference videos. No new motion/grammar model is trained. Samples are taken at up to 20 fps, capped at 180 frames per source. Original reference IDs remain attached.
2. `retarget.py` maps tracked wrists relative to shoulder width, estimates depth from pose landmarks, and rotates individual finger segments onto the existing Blender rig. Bone lengths are preserved. A symmetric filter smooths tracking noise, short gaps are interpolated, and per-frame local angular changes are capped. Entry/exit movement is added for playback transitions.
3. Animation-only GLBs share the existing avatar mesh. `publish_motion_catalog.py` publishes metadata, sources and the limitations report. In the browser, tracks are joined into one animation with a 0.25-second transition interval. Playback does not remount the avatar between words.

## Reproduce

From repository root, with the environment from `ml/rsl/README.md`:

```sh
curl -fL https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task -o ml/rsl/data/motion/pose_landmarker_full.task
ml/rsl/.venv/bin/python ml/rsl/prepare_dictionary.py
ml/rsl/.venv/bin/python ml/rsl/capture_motion.py
/Applications/Blender.app/Contents/MacOS/Blender -b --python art/sign-motion/retarget.py
ml/rsl/.venv/bin/python ml/rsl/publish_motion_catalog.py
npm run test:sign-motion --prefix frontend
```

The pose model is an official Google MediaPipe asset under Apache 2.0; its 9 MB local copy and extraction caches are ignored by Git. `reference-overrides.json` records ten alternative training samples selected by tracking coverage (not recognizer accuracy), with stable dictionary IDs. `improve_motion_references.py` documents how these alternatives were selected. Do not rerun it against a complete motion catalog unless intentionally replacing references.

## Quality and limits

The technical gate requires pose detection in at least 85% of frames and one hand assigned in at least 65%; this is **not** a correctness score. Both-hand identity is assigned by proximity to pose wrists. Interpolation through occlusion may invent finger positions. Depth, contact, handedness and finger crossings can be wrong. Facial grammar and mouth motion are not captured. Text keeps Russian source order; concatenation is not a verified RSL grammatical translation.

Tests check every GLB for compatible skeleton nodes, finite transforms, ordered timestamps and duration; they test combined timelines, phrase matching, morphology, unknown tokens and alphabet/word disambiguation. Initial visual comparison covered Я, хотеть, читать, книга, with browser checks for phrase playback and dictionary entries. This is not a linguistic evaluation of all 203 clips. RSL teacher review is still required before calling them correct teaching demonstrations.

Data adaptations follow the source Bukva/Slovo attribution/share-alike public license. See `frontend/public/avatars/sign-motion/ATTRIBUTION.txt` and each catalog entry's source/reference path. No author endorsement is implied.
