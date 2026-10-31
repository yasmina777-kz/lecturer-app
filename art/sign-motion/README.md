# Traceable reference-to-avatar motion

203 experimental clips cover the current 33 letters and 170-word dictionary. This does not mean the full language is covered or that the motions have been validated by signers.

## Pipeline

1. `ml/rsl/capture_motion.py` applies **pretrained** MediaPipe Hand Landmarker and Pose Landmarker to reference videos. No new motion/grammar model is trained. Samples are taken at up to 20 fps, capped at 180 frames per source. Original reference IDs remain attached.
2. `retarget.py` and `kinematics.py` map wrists and elbow poles relative to tracked shoulders. Whole finger chains are fitted to captured segment directions in the palm frame, with MCP flexion/spread and single-axis distal hinges, including bounded thumb flexion/opposition. Finger translations remain zero. Forearm roll is unwrapped before distribution across skin bones. Symmetric observation filtering, isolated-flip rejection and alternating angular-rate projection clean the curves. Added neutral lead/tail lasts 0.7 s each. This changes motion mechanics; it does not validate the sign's meaning.
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


## Motion v4 — constrained whole-finger fitting

The previous independent joint measurements did not account for how all three phalanges compose into one finger. `finger_chain` now predicts the full rest-relative chain. `fit_finger_directions` fits four bounded parameters to all three captured directions together. Distal axial roll is not a free parameter. MCP lateral spread decreases with flexion, cumulative curl is capped, and a weak temporal preference avoids switching between similar solutions. Existing quaternion curve smoothing and speed limits remain in place. These restrictions reduce mechanical contortions; they are not a full mesh collision solver.

`Blender -b --python art/sign-motion/check_finger_chains.py` compares predicted directions with actual Blender pose-bone transforms for 30 complete finger poses, fits known valid synthetic targets, and tests excessive-curl inputs. This catches chain/rest-space mistakes that individual-hinge tests cannot detect. Maximum synthetic direction error in this check was 1.93 degrees. The per-clip `meanFingerDirectionErrorDegrees` measures fit to tracked landmarks, **not** sign-language accuracy. Captured occlusions, thumb contact and facial grammar still require correction/review; Mixamo alone does not provide those data.

## Explicit capture corrections

`hand_pose_overrides.py` contains a reviewed-on-mesh replacement for the failed captured fist in `letter-410` (А). Four fingers have a coordinated curl, the thumb remains alongside the index, and the inactive hand uses a relaxed pose. The correction blends with the existing lead/tail and keeps the captured arm path. Metadata records `handPoseCorrection: authored-fist-v1`. This is an authored correction to this clip, not a new universal solver or linguistic certification of the remaining library. Browser comparison uses 0.94 s, matching the user's reported bad frame.

## Phrase transition timing

The previous 0.25 s gap applied to every pair of words regardless of the change in joint angles. Across the 32 practice examples, captured boundaries implied a peak eased angular speed of about 1346°/s. `prepare-sign-transitions.mjs` now samples each GLB at its captured lead-in/lead-out boundaries and publishes compact quaternion endpoints with the catalog. `publish_motion_catalog.py` refreshes them after rebuilding/replacing assets.

`transitionDuration` chooses the shared UI/animation gap from the largest joint change and the quintic easing peak derivative (1.875), capped at 240°/s at 1× speed. Legacy clips without endpoints use a conservative 1.5 s gap. Transitions are sampled at 60 Hz; captured signs keep their existing timing. The UI, word seeking and composed clip use the same `gapAfter`. Tests cover the boundary-speed formula for all practice phrases and sample the composed “Я хочу читать книгу” seams at 120 Hz (observed peak 239.5°/s).

This fixes transition timing only. It does not fix captured hand shapes, avoid every mesh collision, model coarticulation, or translate Russian grammar into RSL. The 32 examples are sequences of available assets, not newly trained phrase animations. A production phrase needs a continuous signer reference, corrected hands/body/face, and linguistic review.

### Four-sign reference correction (2026-10-31)

`hand_pose_overrides.py` keeps stable, rig-calibrated hand shapes for **я,
хотеть, читать, книга**, using each entry's linked reference. Straight phalanges
are solved against the actual bone rest axes, rather than assumed zero Euler
angles. `retarget.py` additionally corrects the self-pointing direction, thumb
orientation, and the shared contact/opening of the book gesture (reference
opening at approximately 0.30–0.55 s). These are explicit authored corrections,
not newly trained recognition or translation models. The source recordings remain
available and linguistic review is still required; other entries do not inherit
these poses. The mesh/FK checks do not establish linguistic correctness.

The player's close-up samples the motion before playback and uses a fixed frame
for raised hands and head, with perspective/aspect compensation. Resting hands at
the hip are excluded from the close-up; the full-avatar view remains available.
`node frontend/scripts/check-motion-framing.mjs` checks all three viewing angles
at desktop and phone proportions.
