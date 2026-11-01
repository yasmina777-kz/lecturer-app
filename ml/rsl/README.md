# Local RSL recognition and dictionary

Independent project code; no SignStart code or models were used.

## Current model: 33 isolated letters

`alphabet-classifier.json` is a multinomial logistic classifier trained locally on Bukva. Google's pretrained MediaPipe Hand Landmarker supplies hand landmarks; we did not train that detector. The classifier uses 16 frames: four temporal bins of normalized hand coordinates, wrist movement and visibility, plus 210 average pairwise hand distances (474 features). It has 33 Russian letter classes and `no_event`.

Data selection is deterministic: 45 training and 18 test videos per class, SHA-256 order of attachment IDs, preserving the official signer split. **1,530 training videos / 135 signers; 612 held-out test videos / 20 different signers.** Regularization was selected on a signer-disjoint subset of training data (315 videos), then the final model was fitted on all training data. Test videos were not used for model selection.

Observed test accuracy: **76.47%** (all 612 videos). Fixed probability ≥ 0.70, margin ≥ 0.20, non-background prediction and hands in at least 8/16 frames yield **78.10% coverage**, with **87.45% accuracy among accepted predictions**. Refusals do not count as correct answers. Per-class scores and confusion matrix: `frontend/public/models/rsl/alphabet-report.json`; readable report: `/research/rsl/alphabet-report.html`.

These are subset-video results, not live-camera or pedagogical accuracy. The browser samples short camera recordings or local videos. It uses the same feature aggregation, but camera conditions, decoding and landmark detections can differ. Unknown gestures can still get confident wrong predictions. The model does not recognize words, continuous fingerspelling, phrases, face/body motion or grammar. The expected exercise letter is used only for comparing the result, never as model input.

## Dictionary and text

`/text-to-sign` contains all 33 letter references and **170 words/expressions from Slovo**, with eight thematic word categories. Russian inflections are looked up using a precomputed pymorphy3/OpenCorpora table (3,430 forms). Ambiguities and unsupported words remain visible; negation is not removed. The longest available phrase is matched first.

This is **dictionary lookup, not a trained Russian-to-RSL grammatical translator**. The existing 10 hand-authored 3D clips can be opened by supported exact text. All dictionary entries also have experimental avatar motion captured from the human references. The 170 reference videos are not training samples for a word recognizer; word/phrase recognition has not been trained. Continuous translation requires licensed aligned sentence data, a separate model and evaluation by RSL signers.

## Reproduce

From repository root:

```sh
python3 -m venv ml/rsl/.venv
ml/rsl/.venv/bin/pip install -r ml/rsl/requirements-lock.txt
ml/rsl/.venv/bin/python ml/rsl/prepare_alphabet.py
ml/rsl/.venv/bin/python ml/rsl/extract_alphabet.py
ml/rsl/.venv/bin/python ml/rsl/train_alphabet.py
ml/rsl/.venv/bin/python ml/rsl/render_alphabet_report.py
ml/rsl/.venv/bin/python ml/rsl/prepare_dictionary.py
ml/rsl/.venv/bin/python ml/rsl/prepare_word_forms.py
npm run test:sign-expansion --prefix frontend
```

Training downloads, extraction caches and the virtual environment stay ignored by Git. Clear `data/alphabet/features-v1` when changing extraction. The generated model, reports and selected public reference media are versioned. The previous three-letter pilot remains for regression comparison in `classifier.json` and `training-report.json`; the active practice UI uses the alphabet model.

Inference runs in the browser with locally served MediaPipe weights/WASM and classifier, without an external AI API key. Camera permission is requested only after Start; leaving the exercise closes tracks. User recordings are processed in memory and are not uploaded.

## Avatar

The original seven letter clips and three word/phrase clips are independently authored Blender motion studies, **not expert-verified RSL instruction**. All 33 letters have real human video references. The dictionary and practice room now additionally use 203 experimental reference-captured motions, including all 33 letters; original videos remain available for comparison. These are not expert-verified. Alphabet body animation includes connected shoulders/spine/neck, staggered finger transitions and a stable handshape viewing interval. Finite transforms, loop continuity and quaternion steps are checked during export. Gesture semantics still require an RSL specialist's review.

Scripts: `art/mira-alphabet/build.py`, `art/mira-blender-phrases/animate.py`, `art/mira-blender-v3/animate.py`. Recognition and playback are separate systems. Phrase playback preserves each Blender clip’s coordinated preparation and release, joining only relaxed endpoints. It does not interpolate directly between the meaningful handshapes of different signs. This adds a brief return between words; it is not natural continuous RSL coarticulation. Legacy constant STEP channels are converted to linear output tracks during composition so later moving clips are not played as discontinuous steps.

## Sources and licenses

- [Bukva](https://github.com/ai-forever/bukva), Kvanchiani, Surovtsev, Nagaev, Petrova and Kapitanov (2024).
- [Slovo](https://github.com/ai-forever/slovo), Kapitanov et al.
- Both data sources use their attribution/share-alike public license, not an unmodified Creative Commons license. Full texts and reference IDs are in `frontend/public/research/rsl/` and `words/`. Derived classifier artifacts are distributed under the source terms. No author endorsement is implied.
- MediaPipe: Apache 2.0. pymorphy3: MIT; OpenCorpora dictionaries: CC BY-SA 3.0. Generated inflection table follows the dictionary's attribution/share-alike terms.

## Camera feedback and training bundle

The practice camera now draws the detected hand landmarks continuously (about
8 updates/second) before recording. These points show detection, not a letter
prediction. Recording still collects 16 frames for the trained classifier.
Uploaded videos show the sampled frame and its landmarks as well. Video and
landmarks share one aspect ratio; only the live preview is mirrored. No image
or recording is sent to a server.

Stopping/leaving closes the camera tracks. Disposing the MediaPipe detector
also clears its references, so development hot reload cannot reuse a closed
WebGL context. Camera permission/device errors are separate from model errors.

Create a shareable archive of the actual training code, 2,142 cached feature
sequences, labels/splits, 33 required reference videos, detector weights, fitted
classifier, reports and source licenses:

```sh
python3 ml/rsl/package_training.py /path/to/AI-Mentor-training.zip
```

The archive excludes the full 1.8 GB source-video subset, credentials, and the
Python environment. It includes the source download script and checksums.
The detector is pretrained Google MediaPipe; only the letter classifier was
trained by this project. Packaging does not retrain or change the model.

## Expanded cautious experiment (2026-11-01)

The standard model is retained. An additional MLP model uses 3,013 training
videos (up to 90/class) and the **same 612 held-out videos**. It was selected
using 615 signer-disjoint validation videos inside the training partition.
Five candidates were compared: linear C=0.1/1/10 and a 96-unit ReLU MLP with
alpha=1/5. The selected MLP uses alpha=5 and random_state=42.

| Metric | Standard | Cautious |
|---|---:|---:|
| Overall test accuracy | 76.47% | 75.33% |
| Answer coverage | 78.10% | 38.07% |
| Correct among accepted answers | 87.45% | 100% (233/233) |

Overall improvement was **not** established. Zero observed errors on 233 accepted
answers is not a guarantee on new people or webcam recordings. The cautious
model is optional; refusing an answer is not an assessment that the learner is
wrong. Neither model recognizes free words/phrases or controls avatar animation.

Reproduce the experiment:

```sh
ml/rsl/.venv/bin/python ml/rsl/prepare_alphabet.py --train-per-class 90
ml/rsl/.venv/bin/python ml/rsl/extract_alphabet.py
ml/rsl/.venv/bin/python ml/rsl/train_alphabet_v3.py
ml/rsl/.venv/bin/python ml/rsl/render_model_comparison.py
npm --prefix frontend run test:sign-expansion
```

The `alphabet-cautious-*` files keep the new model and its report separate from
the baseline. `check-sign-expansion.mjs` verifies Python/JavaScript probability
parity for all 34 new-model classes, as well as no-hand rejection. In the downloadable
training archive, `baseline-manifest.json` preserves the previous training selection.
Situational dialogues and comprehension exercises are rule-based learning activities;
they are not represented as newly trained AI.
