# Local KRSL recognition

This is a working local inference integration, **not a reliable unrestricted sign-language translator** and not an avatar animation model. The existing RSL letter recognizer remains separate. No API keys or external inference requests are used.

## Source and verified result

- Author: dastan-issenov. https://huggingface.co/dastan-issenov/krsl-cslr-checkpoints
- Pinned revision: `af4819927e58079f6aad5f3e62a140bb1cdbbb7b`.
- Checkpoint: `conformer_best_stage5_aug.pt`, epoch 111, 1,959 output classes including blank/unknown and annotation punctuation.
- Checkpoint validation WER: **0.5949908153** (33,686 edit errors / 56,616 reference tokens). This is NOT a 59% accuracy score.
- `parity-report.json`: inference logits exactly matched the reviewed author's architecture on a padded batch. This proves compatibility, not accuracy.
- `smoke-report.json`: four local Slovo examples (a different domain) produced three refusals and one wrong draft. **0/4 correct words**. This small check does not estimate corpus WER, but does demonstrate that merely installing these weights is insufficient.
- The linked feature/dataset repositories were inaccessible (HTTP 401) during this integration. No corpus retraining or accuracy improvement is claimed. We do not silently substitute random examples for a held-out dataset.
- The repository has no model card/license declaration. Weights are downloaded locally from the author's repository; neither weights nor upstream training code are republished in Git. Confirm applicable rights before distributing a model or derivative weights.

## Install and start

From the project root (Python 3.12; tested on Apple Silicon):

```sh
python3 -m venv ml/krsl/.venv
ml/krsl/.venv/bin/pip install -r ml/krsl/requirements.txt
ml/krsl/.venv/bin/python ml/krsl/setup.py
ml/krsl/.venv/bin/python ml/krsl/server.py
```

`setup.py` verifies SHA-256 and resumes chunked weight downloads. It never executes upstream Python. After installation, `start.command` starts the service alongside the existing platform unless port 5070 is already occupied. Vite dev/preview proxy `/api/krsl` to `127.0.0.1:5070`. A hosted deployment must configure an authenticated reverse proxy and a separate Python service; the local integration does not magically run on static/Vercel hosting.

Open `/recognition` (the unified **Жесты → текст** page). Turn on the camera once: Clips finish after 1.3 seconds without detected hand movement (minimum 2.4 seconds, maximum 12 seconds), or with the optional finish button. This pause heuristic is not a linguistic boundary detector. Recording continues during inference until the one pending slot fills; then recording pauses visibly until a slot is free. No pending clip is silently overwritten. This is chunked processing, not a frame-by-frame sentence decoder. Long phrases may be cut at chunk boundaries; upload a complete clip instead. Stop/tab changes close tracks and discard stale pending results. No microphone is requested.

Uploads: MP4/WebM/MOV/OGG, ≤25 MiB, ≤20 s, ≤1920×1080. Temporary uploads are removed after processing. No webcam samples or predictions are automatically saved or used for training. Edited captions live only in the current page.

## Actual pipeline

`runtime.py`: MediaPipe **Holistic 0.10.35**, IMAGE mode with a fresh Holistic graph per clip (avoids cross-resolution segmentation-state crashes), original rounded FPS stride, no mirrored pixels or coordinate renormalization. Feature order: 21 left-hand landmarks, 21 right-hand, six upper-body landmarks, 12 eyebrow/mouth landmarks; xyz = 180 features/frame. This is the exact author's input layout, not extra invented sensors. `model.py` implements the compatible Conformer and greedy CTC (collapse repeats BEFORE blank removal). Original beam search is not used; its reported WER must not be attributed to our greedy decoder.

Low landmark coverage, unknown labels, annotation-only symbols and low token posterior produce a refusal. Posterior threshold 0.4 is an **uncalibrated heuristic**, not a guarantee; wrong words can pass. Returned words remain explicitly editable AI drafts. The UI's tracking percentages measure landmark visibility, not recognition accuracy. No grammar is generated and no predicted text is silently sent to the avatar.

## Evaluation and fine tuning

`train.py` accepts a reviewed JSON manifest:

```json
[
  {"video":"clips/person1.mp4","tokens":["я","хотеть","книга"],"group":"signer-1","split":"train"},
  {"video":"clips/person2.mp4","tokens":["книга"],"group":"signer-2","split":"val"},
  {"video":"clips/person3.mp4","tokens":["книга"],"group":"signer-3","split":"test"}
]
```

These are format examples, **not a sufficient training set**. Use many independently labeled performances per target, signer/broadcast-disjoint splits, negative/no-sign clips and different cameras. Tokens must match `data/vocab.json`; unknown labels are rejected rather than converted to UNK. Same file hashes and shared signer/broadcast groups across splits are rejected. Features are extracted from real supplied videos using the same pipeline.

For a reviewed video with no signing, use `"tokens": [], "negative": true`. Empty transcripts without that explicit flag are rejected to avoid training missing annotations as silence. Every split must still contain labeled signing. Keep genuinely continuous phrases in the data; concatenated isolated-word videos do not validate phrase recognition.

```sh
ml/krsl/.venv/bin/python ml/krsl/train.py /absolute/path/manifest.json --check-only
ml/krsl/.venv/bin/python ml/krsl/train.py /absolute/path/manifest.json --evaluate-only
ml/krsl/.venv/bin/python ml/krsl/train.py /absolute/path/manifest.json --epochs 5
```

Reports contain baseline validation/test WER, per-example predictions and candidate results. Only validation chooses the best epoch. A candidate is saved only when validation improves, and is never automatically deployed. Check untouched test results and human review before replacing the serving model. The current work includes the executable training path; it does **not** claim new trained weights.

Each run writes to its own `data/training/<UTC-time>-<run-id>/` directory, so an old candidate cannot be mistaken for the current result. Reports include corpus counts, signer/broadcast groups, labels absent from training, exact transcript match rate, and a separate false-positive rate on no-sign clips (not folded into positive-clip WER). Candidate selection requires lower validation WER without increasing validation no-sign false positives when negatives are present. `--patience 3` stops after three non-improving epochs; `--learning-rate` defaults to `1e-5`. The feature cache is keyed by extractor source, landmark asset and library versions. Reports record manifest and starting-checkpoint hashes.

The initial search on 2026-11-05 found no accessible gloss-labeled continuous-phrase corpus locally. The [FluentSigners-50 record](https://zenodo.org/records/6043739) restricts file access; the project's linked Drive download returns 404. Local Bukva letters and selected Slovo isolated words cannot replace a phrase corpus. The subsequent YouTube-SL-25 acquisition below provides real signing videos with subtitle translations, still pending gloss annotation. These training fixes have been tested with unit/synthetic pipeline checks; no new phrase weights or accuracy gain are claimed. Production still reports `/api/krsl/status` as unavailable; it needs a hosted Python service as well as validated weights. The camera now avoids recording phrase clips while that service is unavailable and leaves letter recognition active.

### YouTube-SL-25 source acquisition (2026-11-05)

The [Google Research source](https://github.com/google-research/google-research/tree/master/youtube_sl_25) publishes a [video index](https://storage.googleapis.com/gresearch/youtube-sl-25/youtube-sl-25-metadata.csv) containing **715 RSL-labeled video IDs** (SHA-256 `79e8d2c35b0d3ed31b7e3c32348a1ce64513ca0ef217d7c1cbbd6b14410e7f08`). The authors describe coarse human filtering, not perfect alignment. This index is a useful acquisition source, not 715 locally downloaded videos.

Downloaded pilot: `ncJBYIb5DOs`, `dJdN5kopJks`, `D3nturQl4k8`: three silent videos, **50.38 minutes**, original Russian subtitle tracks, and **468 subtitle intervals**. They share one channel; speaker identities and split independence have not been established. Sampled frames from the first video visibly contain signing, including changes of signer. All media and full subtitle text remain in ignored `data/sources/youtube-sl-25/`, not in Git or the frontend.

Reproduce acquisition with the optional data tool (`requirements-data.txt`, separate from serving dependencies):

```sh
ml/krsl/.venv/bin/pip install -r ml/krsl/requirements-data.txt
mkdir -p ml/krsl/data/sources/youtube-sl-25/pilot
curl -fL 'https://storage.googleapis.com/gresearch/youtube-sl-25/youtube-sl-25-metadata.csv' -o ml/krsl/data/sources/youtube-sl-25/metadata.csv
ml/krsl/.venv/bin/yt-dlp --no-playlist --skip-download --write-subs --sub-langs ru --sub-format vtt --write-info-json -o 'ml/krsl/data/sources/youtube-sl-25/pilot/%(id)s.%(ext)s' 'https://www.youtube.com/watch?v=ncJBYIb5DOs'
ml/krsl/.venv/bin/yt-dlp --no-playlist -f 'bestvideo[height<=480]' --max-filesize 150M -o 'ml/krsl/data/sources/youtube-sl-25/pilot/%(id)s.%(ext)s' 'https://www.youtube.com/watch?v=ncJBYIb5DOs'
python3 ml/krsl/prepare_youtube_corpus.py ml/krsl/data/sources/youtube-sl-25/metadata.csv ml/krsl/data/sources/youtube-sl-25/pilot ml/krsl/data/sources/youtube-sl-25/review
python3 ml/krsl/test_youtube_corpus.py
```

`review/review-segments.json` preserves original subtitle times and provides half-second context for review. It explicitly leaves `glossTokens`, `signerGroup` and `split` unset. It must not be passed directly to `train.py`: Russian translation text is not the sign gloss sequence required by its CTC objective, and subtitle intervals may cut through signs. Review full utterance boundaries, annotate glosses, identify signing groups, and establish independent train/validation/test samples first. Original video rights are not transferred by publication of the Google index. Metadata retains source license information; these three sources do not declare an explicit license in the downloaded metadata.

Also inspected [SignVerse-2M](https://huggingface.co/datasets/SignerX/SignVerse-2M) at revision `0c7e956a8471acad3a9cebaeb66bb23bf5deaafa`. Although its metadata includes the same 715 RSL IDs, **none have a published archive mapping** in that revision's processed metadata/upload index. Its stated DWPose format uses `(x,y,confidence)`, not our MediaPipe `(x,y,z)` features. Do not claim those RSL poses were downloaded or feed that format into the current checkpoint. Source search and pilot media checks are recorded in `docs/phrase-source-search.json`.

Checks:

```sh
ml/krsl/.venv/bin/python ml/krsl/test_runtime.py
ml/krsl/.venv/bin/python ml/krsl/check_service.py
```

The camera UI records pause-bounded clips while inference runs. At most one request and one pending clip are retained; recording pauses visibly under backpressure. Letters run concurrently in a local Web Worker on the same camera stream. The 16-frame letter model still needs a complete motion window and two agreeing predictions, approximately 3 seconds at normal sampling speed. A single hand pose during a phrase can be classified as a letter; outputs are kept separate rather than inventing automatic language-mode confidence.

`docs/recognition-service-check.json` records the four real Slovo smoke examples after the graph reset fix. All HTTP requests work; three are refused and one predicts an incorrect word. This is not a successful translation benchmark and no new weights were trained.

### Letter camera tracking performance

The letter worker uses MediaPipe VIDEO tracking (`detectForVideo`) with monotonically increasing capture timestamps and `minTrackingConfidence: 0.7`, as described in the [official Hand Landmarker guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js). Detection stays off the UI thread. A preliminary accepted prediction is shown as “Возможно…” while confirmation is pending; only the existing two-window consensus appends a letter. The 16-frame feature window, sampling cadence, weights and classifier thresholds are unchanged.

A browser comparison on 72 frames from А/Б/В recorded examples measured median detector latency 77.7 ms IMAGE vs 66.0 ms VIDEO; detected-hand frames were 72 vs 70. This small replay check is not a recognition-accuracy evaluation or a promise of instantaneous captions. Scene changes can require tracking reacquisition. Phrase processing still uses complete 4-second clips; its model quality has not been improved by these frontend changes. See `docs/motion-flow-check.json`.

### Capture and letter confirmation update

The browser now draws Google Pose Landmarker Lite body landmarks alongside hand landmarks. This is framing feedback, not new recognition training; the server still extracts the same 180-D Holistic features. Response tracking reports left and right hands separately. One-handed signs are not rejected just because the other hand is absent.

On the unified page, both existing letter classifiers must accept the same letter, followed by the existing two-window confirmation. A change in the largest hand's anatomical identity clears the sample window without rearming duplicate letters. The conservative agreement gate reduces coverage and can still accept errors; it is not validated for unrestricted phrase negatives. `docs/recognition-capture-check.json` records cached 612-video evaluation: baseline 478 accepted / 60 wrong, agreement 232 accepted / 0 wrong. This is not 100% general or webcam accuracy, and no new training ran.

Checks: `npm run test:phrase-capture --prefix frontend`; add `-- --evaluate` with the local feature cache present to regenerate the cached evaluation. Real browser replay confirmed body/hand overlays, automatic 12-second limit, manual completion, visible queue backpressure and stop cleanup. The same reference letter clip remained rejected by KRSL; no phrase-quality improvement is claimed.
