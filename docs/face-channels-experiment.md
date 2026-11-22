# Face channels for word recognition — experiment (2026-11-22)

Question: do facial channels (mouthing, brows, eyes, head pose; 21 per frame from
MediaPipe Face Landmarker, `ml/rsl/face_features.py`) improve Slovo word recognition
on signers never seen in training?

| model | features | top-1 all 1000 | top-1 course (941) |
|---|---|---|---|
| v5 seed 42 (shipped, ensemble of 3) | hands + body | 0.587 (ens. 0.626) | 0.597 (ens. 0.639) |
| v6 seed 42 | + raw face | 0.435 | 0.446 |
| v6b seed 42 | + face relative to the clip's own median | 0.569 | 0.582 |

Raw face values let the model learn signer-specific resting expressions (identity
shortcut). Relative values remove most of that, but still do not beat v5 on isolated
Slovo words. **Words v5 stays in production.** The face pipeline is kept
(`extract_slovo_face.py`, `build_word_features_v6b.py`, `train_slovo_v6b.py`,
`faceRow` in `wordFeatures.ts` with a Python/JS parity test) for continuous phrases,
where brows and head movement carry grammar, and for the facial-grammar trainer.
