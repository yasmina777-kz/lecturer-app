# Local RSL recognition and dictionary

Independent project code; no SignStart code or models were used.

## Current model: 33 isolated letters

`alphabet-classifier.json` is a multinomial logistic classifier trained locally on Bukva. Google's pretrained MediaPipe Hand Landmarker supplies hand landmarks; we did not train that detector. The classifier uses 16 frames: four temporal bins of normalized hand coordinates, wrist movement and visibility, plus 210 average pairwise hand distances (474 features). It has 33 Russian letter classes and `no_event`.

Data selection is deterministic: 45 training and 18 test videos per class, SHA-256 order of attachment IDs, preserving the official signer split. **1,530 training videos / 135 signers; 612 held-out test videos / 20 different signers.** Regularization was selected on a signer-disjoint subset of training data (315 videos), then the final model was fitted on all training data. Test videos were not used for model selection.

Observed test accuracy: **76.47%** (all 612 videos). Fixed probability ≥ 0.70, margin ≥ 0.20, non-background prediction and hands in at least 8/16 frames yield **78.10% coverage**, with **87.45% accuracy among accepted predictions**. Refusals do not count as correct answers. Per-class scores and confusion matrix: `frontend/public/models/rsl/alphabet-report.json`; readable report: `/research/rsl/alphabet-report.html`.

These are subset-video results, not live-camera or pedagogical accuracy. The browser samples short camera recordings or local videos. It uses the same feature aggregation, but camera conditions, decoding and landmark detections can differ. Unknown gestures can still get confident wrong predictions. The model does not recognize words, continuous fingerspelling, phrases, face/body motion or grammar. The expected exercise letter is used only for comparing the result, never as model input.

## Dictionary and text

`/text-to-sign` contains all 33 letter references and **170 words/expressions from Slovo**, with eight thematic word categories. Russian inflections are looked up using a precomputed pymorphy3/OpenCorpora table (3,430 forms). Ambiguities and unsupported words remain visible; negation is not removed. The longest available phrase is matched first.

This is **dictionary lookup, not a trained Russian-to-RSL grammatical translator**. The existing 10 hand-authored 3D clips can be opened by supported exact text. Other entries show real human references. The 170 reference videos are not training samples for a word recognizer; word/phrase recognition has not been trained. Continuous translation requires licensed aligned sentence data, a separate model and evaluation by RSL signers.

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

Seven letter clips and three word/phrase clips are independently authored Blender motion studies, **not expert-verified RSL instruction**. All 33 letters have real human video references. Letters without a 3D clip show the reference rather than fabricated motion. Alphabet body animation includes connected shoulders/spine/neck, staggered finger transitions and a stable handshape viewing interval. Finite transforms, loop continuity and quaternion steps are checked during export. Gesture semantics still require an RSL specialist's review.

Scripts: `art/mira-alphabet/build.py`, `art/mira-blender-phrases/animate.py`, `art/mira-blender-v3/animate.py`. Recognition and playback are separate systems.

## Sources and licenses

- [Bukva](https://github.com/ai-forever/bukva), Kvanchiani, Surovtsev, Nagaev, Petrova and Kapitanov (2024).
- [Slovo](https://github.com/ai-forever/slovo), Kapitanov et al.
- Both data sources use their attribution/share-alike public license, not an unmodified Creative Commons license. Full texts and reference IDs are in `frontend/public/research/rsl/` and `words/`. Derived classifier artifacts are distributed under the source terms. No author endorsement is implied.
- MediaPipe: Apache 2.0. pymorphy3: MIT; OpenCorpora dictionaries: CC BY-SA 3.0. Generated inflection table follows the dictionary's attribution/share-alike terms.
