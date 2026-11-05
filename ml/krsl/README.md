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

Reports contain baseline validation/test WER, per-example predictions and candidate results. Only validation chooses the best epoch. A candidate is saved only when validation improves, and is never automatically deployed. Check untouched test results and human review before replacing the serving model. This CTC training path has not yet produced newly trained serving weights. The separate subtitle translation experiment below does produce research weights.

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

### Actual subtitle-supervised training pilot (2026-11-05)

`extract_subtitle_features.py`, `subtitle_model.py`, and
`train_subtitle_translation.py` provide a **separate, trainable video-to-text
experiment**. The additional source `0EQJSyjbSAQ` has an original Russian
subtitle track and visibly signing presenter in sampled frames. The complete
pilot now contains four videos (55.83 minutes), 508 subtitle intervals. RGB
frames are used only to extract Holistic landmarks; on-screen subtitle pixels
never enter the learned translator.

This model is initialized from scratch: a 722,357-parameter temporal Transformer
encoder and character decoder, with no pretrained language model or LLM API.
Features include both hands, six upper-body points and twelve facial points.
Body-relative normalization preserves missing observations; frame differences
provide motion information. Translation targets are subtitle text, **not**
fabricated gloss labels. An autoregressive decoder can learn a different output
word order, but that architecture alone does not establish translation quality.

`subtitle-pilot-splits.json` fixes whole recordings before training: both parts
of the Zaitseva biography stay in training, glossary news is validation, and a
different-channel recording is the untouched final test. This is not a verified
signer-disjoint benchmark: identities were not audited, validation shares a
channel with training, and test topic differs substantially. Tracking and length
filters retain 262 training, 144 validation and 40 test clips. Subtitle boundaries
and translations remain unreviewed weak supervision.

```sh
# First acquire all four IDs with original ru subtitles as above, including:
# https://www.youtube.com/watch?v=0EQJSyjbSAQ
python3 ml/krsl/prepare_youtube_corpus.py ml/krsl/data/sources/youtube-sl-25/metadata.csv ml/krsl/data/sources/youtube-sl-25/pilot ml/krsl/data/sources/youtube-sl-25/review
ml/krsl/.venv/bin/python ml/krsl/extract_subtitle_features.py
ml/krsl/.venv/bin/python ml/krsl/train_subtitle_translation.py --splits ml/krsl/subtitle-pilot-splits.json --device cpu --epochs 60
ml/krsl/.venv/bin/python -m unittest discover -s ml/krsl -p 'test_*.py'
```

Each run saves `candidate.pt`, `report.json`, and local-only
`test-predictions.json` under ignored `data/subtitle-training/<run>/`. Extraction
caches are fingerprinted by source video, feature code, landmark model and
library versions. Missing/stale caches, duplicate videos and related recording
groups crossing splits are rejected. Only training text determines the character
vocabulary. Validation uses free-running generation every five epochs; test is
evaluated after checkpoint selection, not used to select epochs. The report
includes WER, character error rate, whole-phrase matches, a constant-text
baseline, and a zero-visual-input ablation. WER can exceed 100% because insertions
count as errors. Teacher-forced training loss is not reported as recognition
accuracy.

This pilot never activates a candidate in `runtime.py`, changes the working
letter model, or uploads source footage. The weights remain research-only until
reviewed phrase data, independent signer/webcam tests and no-sign negatives
establish useful quality. Existing phrase service hosting is a separate
unresolved production requirement.

**Measured outcome:** run `20261105T121751Z-1e4fbe` stopped after 55 epochs;
validation selected epoch 40. On the 40 held-out test clips, exact matches were
**0/40**, WER **207.17%** (520 edits / 251 reference words), CER **168.77%**.
The constant-text baseline had WER 141.04%; removing all visual features gave
154.58%. Thus this experiment did **not** establish useful gesture recognition
or improve the platform. Do not use these weights for user-visible subtitles.
The checkpoint is 5,008,301 bytes and remains in the local run directory; the
reproducibility report without full subtitle text is
`docs/phrase-subtitle-training-pilot.json`. The 15 passing protocol/unit tests
verify implementation behavior, not recognition quality. Further work needs
more diverse, reviewed phrase data and separate live-camera evaluation.

### Expanded corpus and alignment review (2026-11-05)

After the failed pilot, `expand_subtitle_corpus.py` inspected 48 additional
indexed sources. Ten selected videos from **six channels** were downloaded with
their original Russian subtitle tracks: **52.22 additional minutes / 624
nonempty subtitle intervals**. The total local corpus is now **14 videos,
108.05 minutes, 1,132 intervals**. Full media and captions remain ignored under
`data/sources/youtube-sl-25/expansion/`; only provenance/quality summaries are
committed. Source publication is not a transfer of the original video license.

Visual inspection sampled three frames in each new recording. Interview videos
contain changes between presenters; other sources show outdoor, studio and
webcam-like settings. `subtitle-expansion-catalog.json` records sample times and
observations, rather than inventing a verified unique-signer count. Related
interview parts stay in the same proposed training group. Museum recordings are
proposed for validation and a separate-channel recording for test. These are
**provisional** groups: channel separation is not proof of signer separation.
The prior test source/channel is excluded from new training acquisitions.

`audit_subtitle_alignment.py` decoded the cached Holistic sequences, checked
subtitle timing and landmark coverage for every new interval. Seven empty
caption cues are explicitly logged and excluded, not mislabeled as silence.
**17** intervals enter technical quarantine (short clips, long hand-tracking
gaps, or missing face/hands). **607** pass this technical filter; none is
automatically approved semantically. **260** have hand motion at a subtitle
edge and are prioritized for boundary review; this is a heuristic warning, not
proof of a wrong boundary. No boundaries are silently adjusted.

Three focused visual checks distinguish actual issues:

- `IBeed1Vp-fU:47`: an interview changes into a still photograph inside the cue;
  excluded from training candidates after visual inspection.
- `GhuCvTuEx1s:6`: the presenter is visibly signing but small/blurry; missing
  facial landmarks indicate an extraction problem, not necessarily bad captions.
- `-TM9wjZ3rvY:87`: the end includes an outro without the presenter; the phrase
  end needs review before trimming.

The local review page shows the video, subtitle, timestamps, flags and editable
translation together. It supports slow playback, clipping with context,
reviewer/signer IDs, split choices, saved decisions and JSON export. Positive
approval requires explicit RSL, meaning and timing confirmations; both the UI
and `validate_reviewed` reject an annotated signer or recording crossing splits.
No model is trained or activated by clicking Save. Semantic review still
requires an annotator competent in RSL; automated tracking cannot supply it.

```sh
# Discovery is bounded and resumable; review selection before media acquisition.
ml/krsl/.venv/bin/python ml/krsl/expand_subtitle_corpus.py scan --count 48
ml/krsl/.venv/bin/python ml/krsl/expand_subtitle_corpus.py download --selection ml/krsl/subtitle-expansion-catalog.json
ml/krsl/.venv/bin/python ml/krsl/prepare_youtube_corpus.py ml/krsl/data/sources/youtube-sl-25/metadata.csv ml/krsl/data/sources/youtube-sl-25/expansion/media ml/krsl/data/sources/youtube-sl-25/expansion/review
ml/krsl/.venv/bin/python ml/krsl/extract_subtitle_features.py --audit ml/krsl/data/sources/youtube-sl-25/expansion/review/source-audit.json --output ml/krsl/data/sources/youtube-sl-25/expansion/features
ml/krsl/.venv/bin/python ml/krsl/audit_subtitle_alignment.py --audit ml/krsl/data/sources/youtube-sl-25/expansion/review/source-audit.json --segments ml/krsl/data/sources/youtube-sl-25/expansion/review/review-segments.json --features ml/krsl/data/sources/youtube-sl-25/expansion/features --catalog ml/krsl/subtitle-expansion-catalog.json --output ml/krsl/data/sources/youtube-sl-25/expansion/quality
ml/krsl/.venv/bin/python ml/krsl/serve_subtitle_review.py
# Open http://127.0.0.1:8782/quality/index.html
```

Use the provided loopback-only server: byte-range responses are required for
reliable video seeking in the in-app browser; plain `python -m http.server` did
not seek correctly. Exported annotation JSON contains source hashes and the
original text/timings alongside corrections. Keep it local until checked.
`docs/phrase-corpus-expansion-audit.json` contains the measured audit. No new
training or deployment is claimed for this expansion, and recognition quality
has not yet improved merely because more videos were collected.

The camera UI records pause-bounded clips while inference runs. At most one request and one pending clip are retained; recording pauses visibly under backpressure. Letters run concurrently in a local Web Worker on the same camera stream. The 16-frame letter model still needs a complete motion window and two agreeing predictions, approximately 3 seconds at normal sampling speed. A single hand pose during a phrase can be classified as a letter; outputs are kept separate rather than inventing automatic language-mode confidence.

`docs/recognition-service-check.json` records the four real Slovo smoke examples after the graph reset fix. All HTTP requests work; three are refused and one predicts an incorrect word. This is not a successful translation benchmark and no new weights were trained.

### Letter camera tracking performance

The letter worker uses MediaPipe VIDEO tracking (`detectForVideo`) with monotonically increasing capture timestamps and `minTrackingConfidence: 0.7`, as described in the [official Hand Landmarker guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js). Detection stays off the UI thread. A preliminary accepted prediction is shown as “Возможно…” while confirmation is pending; only the existing two-window consensus appends a letter. The 16-frame feature window, sampling cadence, weights and classifier thresholds are unchanged.

A browser comparison on 72 frames from А/Б/В recorded examples measured median detector latency 77.7 ms IMAGE vs 66.0 ms VIDEO; detected-hand frames were 72 vs 70. This small replay check is not a recognition-accuracy evaluation or a promise of instantaneous captions. Scene changes can require tracking reacquisition. Phrase processing still uses complete 4-second clips; its model quality has not been improved by these frontend changes. See `docs/motion-flow-check.json`.

### Capture and letter confirmation update

The browser now draws Google Pose Landmarker Lite body landmarks alongside hand landmarks. This is framing feedback, not new recognition training; the server still extracts the same 180-D Holistic features. Response tracking reports left and right hands separately. One-handed signs are not rejected just because the other hand is absent.

On the unified page, both existing letter classifiers must accept the same letter, followed by the existing two-window confirmation. A change in the largest hand's anatomical identity clears the sample window without rearming duplicate letters. The conservative agreement gate reduces coverage and can still accept errors; it is not validated for unrestricted phrase negatives. `docs/recognition-capture-check.json` records cached 612-video evaluation: baseline 478 accepted / 60 wrong, agreement 232 accepted / 0 wrong. This is not 100% general or webcam accuracy, and no new training ran.

Checks: `npm run test:phrase-capture --prefix frontend`; add `-- --evaluate` with the local feature cache present to regenerate the cached evaluation. Real browser replay confirmed body/hand overlays, automatic 12-second limit, manual completion, visible queue backpressure and stop cleanup. The same reference letter clip remained rejected by KRSL; no phrase-quality improvement is claimed.
