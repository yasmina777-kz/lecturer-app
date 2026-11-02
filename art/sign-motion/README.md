# Traceable reference-to-avatar motion

203 experimental clips cover the current 33 letters and 170-word dictionary. This does not mean the full language is covered or that the motions have been validated by signers.

## Pipeline

1. `ml/rsl/capture_motion.py` applies **pretrained** MediaPipe Hand Landmarker and Pose Landmarker to reference videos. No new motion/grammar model is trained. Samples are taken at up to 20 fps, capped at 180 frames per source. Original reference IDs remain attached.
2. `retarget.py` and `kinematics.py` map wrists and elbow poles relative to tracked shoulders. Whole finger chains are fitted to captured segment directions in the palm frame, with MCP flexion/spread and single-axis distal hinges, including bounded thumb flexion/opposition. Finger translations remain zero. Forearm roll is unwrapped before distribution across skin bones. Symmetric observation filtering, isolated-flip rejection and alternating angular-rate projection clean the curves. Added neutral lead/tail lasts 0.7 s each. This changes motion mechanics; it does not validate the sign's meaning.
3. Animation-only GLBs share the existing avatar mesh. `publish_motion_catalog.py` publishes metadata, sources and the limitations report. In the browser, tracks are joined into one animation. The current v8 path retains the coordinated preparation and release. Every clip uses the same relaxed boundary pose; a short quintic eased transition joins those identical endpoints. The UI uses the same complete timing. Playback does not remount the avatar between words.

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

### Coordinated motion pipeline v5

The final smoothing pass previously changed each arm bone independently. That
moved the wrist away from its measured target (sometimes by centimetres), and
could destroy contact even when the original IK solve was correct. v5 filters
wrist/elbow trajectories, then solves the complete arm again. The elbow pole is
confidence weighted and continuous near an extended arm. `finalWristErrorMeters`
is the solver error BEFORE export, not a linguistic accuracy score.

Landmarks use monotone Hermite interpolation. The thumb base has a bounded
opposition axis in addition to flexion and abduction; PIP/DIP joints remain
hinges. A shared time map limits speed for the entire pose instead of slowing
individual bones independently. It accounts for Blender's quaternion nlerp
midpoint speed and records the resulting lead-in/out times. DQ volume preservation
is enabled in the Blender workshops to match the website's skinning.

Run `check_trajectories.py` and `check_finger_chains.py` through Blender, then
`publish_motion_catalog.py` and `npm run test:sign-motion --prefix frontend`.
The publisher adds a content revision to each motion so the browser loads a new
asset after a correction. `hand_motion_study.py` makes a six-second articulation
study and an editable `.blend`; it is explicitly NOT a sign-language lesson.
These rig and timing improvements do not repair every uncertain source landmark
or establish correct RSL grammar. Expert reference review remains necessary.

### Body clearance v7

`clear_body.py` runs after the v6 finger/arm bake and before publishing. It uses
vertices of the evaluated character and shirt, rather than a wrist-only sphere.
For hands and forearms it measures clearance from the front surface of the
head/torso/clothing. Both wrists receive a shared depth correction, with a smooth
anticipatory envelope; elbow IK and source forearm twist are transported together.
The elbow route is unwrapped over time to avoid a 180° branch flip. The entire
pose is then retimed under the existing joint-speed limit. The standing idle is
processed too (`ready-idle.glb`). Appearance and finger hinge curves are retained.

```sh
# Keep an immutable copy of the v6 input catalog and clips before this step.
/Applications/Blender.app/Contents/MacOS/Blender -b --python art/sign-motion/clear_body.py -- input=/path/to/v6-motion
python3 ml/rsl/publish_motion_catalog.py
/Applications/Blender.app/Contents/MacOS/Blender -b --python art/sign-motion/verify_body_clearance.py -- report=/tmp/body-clearance.json
node frontend/scripts/export-phrase-clearance-qa.mjs
/Applications/Blender.app/Contents/MacOS/Blender -b --python art/sign-motion/verify_body_clearance.py -- directory=/tmp/sign-phrase-clearance-qa report=/tmp/phrase-clearance.json
npm run test:sign-motion --prefix frontend
```

Both Blender scripts accept `batch=0/3` (and the other two indices) for disjoint
batches. The independent verifier reloads exported GLBs, evaluates the skin at
60 Hz including lead-in/out, and fails above 2 mm of front-surface overlap.
`sourceFrameTimes` maps each original 30 Hz frame to corrected playback time;
`sourceWristFitErrorMeters` describes the input fit, not the intentionally changed
wrist trajectory. The public `body-clearance-report.json` records export checks.

This is a conservative front-surface constraint, not a general triangle-mesh
collision engine: it does not certify hand-to-hand contacts, every possible
runtime crossfade, or linguistic correctness. Large depth corrections can change
a sign's placement. Occluded fingers, mouth grammar and source-data mistakes
still require human RSL review. Passing mechanical checks is not a claim that
the avatar has learned all words or translates Russian grammar into RSL.

If the independent export check fails after retiming, copy the current GLB/JSON
and catalog to a new input directory and run `clear_body.py -- input=... refine
<failed-id>`. This corrects the now-sampled intermediate poses and composes the
original-time mapping, rather than discarding it. Reload and verify the result
again. Never publish merely because the pre-export `afterMaxMeters` is zero.

The idle/start/finish checks run the actual `AvatarPlayback` mixer at three idle
phases for 13 selected movements (78 transitions):

```sh
node frontend/scripts/export-phrase-clearance-qa.mjs /tmp/sign-idle-clearance-qa --idle-transitions
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python art/sign-motion/verify_body_clearance.py -- directory=/tmp/sign-idle-clearance-qa report=/tmp/idle-clearance.json
python3 ml/rsl/publish_clearance_validation.py --library /tmp/body-clearance.json --phrases /tmp/phrase-clearance.json --idle /tmp/idle-clearance.json
```

For batched verification, pass all library reports after `--library`.
`test:sign-motion` rejects a missing/stale validation report using the hashes of
all 207 GLBs, the model, and the runtime composition/playback sources.

### Video-reference pilot: «Привет!» (2026-11-02)

`word-f17a6060` uses Slovo training recording
`f17a6060-6ced-4bd1-9886-8578cfbb864f` (63 frames, 30 fps).
The exact recording, signer ID and attribution are in the word catalog. Its
open right-hand shape is manually constrained against the recording because
motion blur causes missed hand detections; wrist/body paths come from tracking.
This is motion retargeting, not new AI training or a certified RSL translation.

```sh
ml/rsl/.venv/bin/python ml/rsl/build_reference_motion.py word-f17a6060
# Review the exported motion against its recording before publishing:
ml/rsl/.venv/bin/python ml/rsl/publish_motion_catalog.py
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python art/sign-motion/export_workshop.py -- word-f17a6060 /tmp/Avatar-Privet-Motion.blend
```

The one-reference command checks the final GLB at 60 Hz. It does not silently
publish or refresh the library validation report. Merge that new check into the
existing report only when unchanged clips still match their recorded hashes.
`retarget-rest-anchor.glb` preserves the original pre-v8 neutral pose from the
project's Mixamo Standing Idle adaptation (same attribution as
`frontend/public/avatars/mixamo-trial/ATTRIBUTION.txt`). Reusing the already
corrected v8 idle as input would apply the arm solver twice and change endpoints.

`sourceTimeline` maps final animation time to original video time through both
Blender retiming passes. The «Видео → аватар» panel uses this mapping and the
same pause/seek controls. Preparation/release freeze the source's boundary
frames. Other clips do not claim synchronized comparison until rebuilt with
this mapping. The pilot's release is still slower than the human recording;
face/mouth motion and semantic correctness have not been validated.

### Arm anatomy v8 (current)

v7 prevented front-surface intersections but preserved the captured forearm
orientation after changing the elbow, and aimed the upper arm independently.
That could leave the skin's elbow hinge facing almost 180° away from the actual
bend plane. Slow motion and collision-free vertices did not prevent this defect.

`arm_anatomy.py` solves each elbow toward a down/outward pole, with only 20% of
the captured pole. It aligns the upper-arm and proximal-forearm frames to the
same bend plane. Pronation is measured relative to that plane, unwrapped over
time, bounded to ±85°, and distributed through the three roll bones. Wrist
swing is bounded to 65°; finger articulation is retained. These are rig comfort
limits, not a clinical model or a guarantee of RSL accuracy. Changed palm
orientation and sign location still need language review.

`bake_arm_anatomy.py` applies this to all 206 motions and the idle, adds paired
hand depth clearance where required, and retimes whole poses. Deform constraints
are removed before clearing Blender driver data; otherwise disabled workshop
controllers can silently reactivate and override the baked animation.

After the v7 clearance stage, preserve its GLBs, per-clip JSON and catalog in an
immutable input directory, then run. The complete v7 input is also preserved in
Git commit `92dcd00` under `frontend/public/avatars/sign-motion` (extract it to a
separate directory, not over the current v8 output):

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python art/sign-motion/bake_arm_anatomy.py -- input=/path/to/v7-motion
python3 ml/rsl/publish_motion_catalog.py
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python art/sign-motion/verify_body_clearance.py -- anatomy report=/tmp/body-clearance.json
```

`batch=0/3`, `1/3`, `2/3` partition the bake. Export the 32 composed phrases and
78 idle transitions as above, and include `anatomy` in their verification calls.
The independent exported-pose checks reject elbow pole deviations over 30°,
hinge-plane errors over 8°, pronation over 86°, wrist swing over 66°, and body
penetration over 2 mm. The small margin over bake limits allows GLB interpolation.
The publisher and `test:sign-motion` require v8 assets and these measured checks;
old clearance-only reports cannot pass the new gate.

Every clip now uses a shared relaxed boundary pose (checked within 0.3° and
0.1 mm after GLB export), blended only inside
the preparation/release and then passed through the same anatomy and clearance
solver. This prevents a new body collision between two individually safe but
different rest poses. Playback holds the verified release pose on completion;
it no longer crossfades the completed sign into an unrelated idle. The 78 runtime
checks cover starts and completed-pose holds at three idle phases.
