# Traceable reference-to-avatar motion

203 experimental clips cover the current 33 letters and 170-word dictionary. This does not mean the full language is covered or that the motions have been validated by signers.

## Pipeline

1. `ml/rsl/capture_motion.py` applies **pretrained** MediaPipe Hand Landmarker and Pose Landmarker to reference videos. No new motion/grammar model is trained. Samples are taken at up to 20 fps, capped at 180 frames per source. Original reference IDs remain attached.
2. `retarget.py` and `kinematics.py` map wrists and elbow poles relative to tracked shoulders. Finger poses are measured in the palm frame: MCP joints have flexion/spread, PIP/DIP joints have a single hinge axis, and the thumb has a separate saddle-joint swing. Finger translations remain zero. Forearm roll is unwrapped before distribution across skin bones. Symmetric observation filtering, isolated-flip rejection and alternating angular-rate projection clean the curves. Added neutral lead/tail lasts 0.7 s each. This changes motion mechanics; it does not validate the sign's meaning.
3. Animation-only GLBs share the existing avatar mesh. `publish_motion_catalog.py` publishes metadata, sources and the limitations report. In the browser, tracks are joined into one animation. Synthetic lead/tail poses between words are trimmed, preserving the captured source interval. A 0.25-second quintic eased transition connects adjacent poses; the UI uses the same trimmed timing. Playback does not remount the avatar between words.

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

## Motion v2 review

`Avatar-motion-workshop.blend` is an ignored local Blender project with the shared mesh/rig and the “книга” animation, ready for manual hand and curve review. Rebuilding the library also refreshes this file. Raw capture, comparison images and Blender binaries stay outside Git; scripts and GLB assets are versioned.

Mechanical checks cover all 203 clips: no off-axis PIP/DIP twist, finite transforms, compatible skeletons and continuous trimmed playback timestamps. The angular-rate cleanup can alter timing around tracking errors; it cannot infer correct contact, facial grammar or occluded fingers. Human review is still required.

Seven saved pre-change clips (А, И, я, читать, хотеть, мать, книга; Git `ff00e9f`) were compared at 30 Hz within their captured intervals. Finger angular-acceleration p95 decreased by 32–54% on those samples. This is a mechanical smoothness measure, not recognition/sign accuracy. Reproduce with `node frontend/scripts/compare-sign-curves.mjs`; all-library checks additionally require no joint step above 8.1° at 30 fps and no translating finger joints.

## Motion v3 — Mixamo calibration and joint volume

`calibrate_mixamo.py` reads the locally downloaded, retargeted Mixamo Talking and Standing Idle projects. It derives 30 rig-specific flexion axes, removes longitudinal roll from the hinge reference, and records 20 rest-joint curvature offsets. These are calibration measurements, not RSL animations or a newly trained model. Reproduce the Mixamo imports first using `art/mixamo-trial/import_motion.py`; source FBX files remain local.

`kinematics.py` subtracts those rest bends so a source straight finger does not receive an extra bend from the mesh. Non-thumb distal measurements are projected onto the flexion plane to avoid turning lateral tracking noise into extra curl. Joint limits and the existing symmetric time filter remain active. A 65% body-only Standing Idle delta drives hips/spine; tracked shoulder reach and wrist IK are solved afterwards, keeping sign hand targets independent of the body layer. Generic Talking gestures never replace signs.

The web renderer uses `volumeSkinning.ts` dual-quaternion deformation for the rigid Mira skeleton, including matching normals and shadow geometry. This avoids the volume collapse caused by averaging bone matrices at a rotated wrist. This implementation requires unit-scale deformation bones; the full-library check enforces that assumption. It does not repair wrong source landmarks or guarantee collision-free thumb/finger contacts.

Checks: `Blender -b --python art/sign-motion/check_calibration.py` tests 60 actual joint poses (straight, 20°, 60° across 20 hinges); `node frontend/scripts/check-volume-skinning.mjs` checks surface/shadow integration. Rebuilt all 203 clips with motionVersion 3. Browser review covers the open-hand book gesture, the closed-hand letter А and a multiword sequence; complete linguistic and contact validation remains outstanding.
