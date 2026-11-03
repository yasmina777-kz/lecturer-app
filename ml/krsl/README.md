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

Open `/recognition` → **Фразы · KRSL**. Turn on the camera once: 6-second recording → result → next recording. The processing interval is a visible pause, not gapless streaming. Long phrases may be cut at chunk boundaries; upload a complete clip instead. Stop/tab changes close tracks and discard stale pending results. No microphone is requested.

Uploads: MP4/WebM/MOV/OGG, ≤25 MiB, ≤20 s, ≤1920×1080. Temporary uploads are removed after processing. No webcam samples or predictions are automatically saved or used for training. Edited captions live only in the current page.

## Actual pipeline

`runtime.py`: MediaPipe **Holistic 0.10.35**, IMAGE mode, original rounded FPS stride, no mirrored pixels or coordinate renormalization. Feature order: 21 left-hand landmarks, 21 right-hand, six upper-body landmarks, 12 eyebrow/mouth landmarks; xyz = 180 features/frame. This is the exact author's input layout, not extra invented sensors. `model.py` implements the compatible Conformer and greedy CTC (collapse repeats BEFORE blank removal). Original beam search is not used; its reported WER must not be attributed to our greedy decoder.

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

```sh
ml/krsl/.venv/bin/python ml/krsl/train.py /absolute/path/manifest.json --evaluate-only
ml/krsl/.venv/bin/python ml/krsl/train.py /absolute/path/manifest.json --epochs 5
```

Reports contain baseline validation/test WER, per-example predictions and candidate results. Only validation chooses the best epoch. A candidate is saved only when validation improves, and is never automatically deployed. Check untouched test results and human review before replacing the serving model. The current work includes the executable training path; it does **not** claim new trained weights.

Checks:

```sh
ml/krsl/.venv/bin/python ml/krsl/test_runtime.py
ml/krsl/.venv/bin/python ml/krsl/check_service.py
```
