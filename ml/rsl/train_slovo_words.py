"""Train and signer-disjointly evaluate an isolated RSL word recognizer on Slovo.

Uses the dataset's published MediaPipe keypoint export, not subtitle pseudo-labels.
This is an isolated-sign classifier: it does not translate continuous RSL sentences.
Raw keypoints and trained outputs stay in the ignored local data directory unless
the publisher's attribution/share-alike terms are met for redistribution.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import time
from pathlib import Path

import ijson
import numpy as np
from sklearn.metrics import accuracy_score, top_k_accuracy_score
from sklearn.neural_network import MLPClassifier
from threadpoolctl import threadpool_limits

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "ml/rsl/data"
ANNOTATIONS = DATA / "slovo-annotations.csv"
KEYPOINTS = DATA / "slovo_mediapipe.json"


def annotation_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def _landmarks(points: list[dict]) -> np.ndarray | None:
    if not isinstance(points, list) or len(points) != 21:
        return None
    try:
        p = np.asarray([[v["x"], v["y"], v["z"]] for v in points], dtype=np.float32)
    except (KeyError, TypeError, ValueError):
        return None
    if p.shape != (21, 3) or not np.isfinite(p).all():
        return None
    # Keep hand orientation, but remove most camera scale and translation.
    scale = float(np.linalg.norm(p[0] - p[9]))
    if scale < 1e-4:
        return None
    local = (p - p[0]) / scale
    # Add the wrist location so movement through signing space remains visible.
    return np.concatenate((local.reshape(-1), p[0] * 2.0 - np.asarray([1, 1, 0], dtype=np.float32)))


def sequence_features(frames: list[dict], frame_count: int = 16) -> np.ndarray:
    """Resample both detected hands into fixed-size spatial-temporal features."""
    if not frames:
        return np.zeros(frame_count * 132, dtype=np.float32)
    positions = np.linspace(0, max(0, len(frames) - 1), frame_count).round().astype(int)
    result = np.zeros((frame_count, 132), dtype=np.float32)
    for out_i, frame_i in enumerate(positions):
        frame = frames[int(frame_i)] or {}
        if not isinstance(frame, dict):
            continue
        for hand_i, hand_key in enumerate(("hand 1", "hand 2")):
            feat = _landmarks(frame.get(hand_key))
            if feat is not None:
                start = hand_i * 66
                result[out_i, start:start + 66] = feat
    return result.reshape(-1)


def signer_validation(user_id: str) -> bool:
    # Stable, reproducible validation group drawn only from official train signers.
    return int(hashlib.sha256(user_id.encode()).hexdigest()[:8], 16) % 5 == 0


def load_features(rows: list[dict[str, str]], cache: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[str], dict]:
    if cache.exists():
        with np.load(cache, allow_pickle=False) as d:
            return d["x"], d["y"], d["users"], d["labels"].tolist(), json.loads(str(d["metadata"]))

    by_id = {row["attachment_id"]: i for i, row in enumerate(rows)}
    # Slovo's no_event samples contain no hand landmarks by design. Detection
    # handles absence of a tracked hand; this classifier is only for signed clips.
    labels = sorted({row["text"].strip() for row in rows if row["text"].strip() != "no_event"})
    label_index = {label: i for i, label in enumerate(labels)}
    x = np.zeros((len(rows), 16 * 132), dtype=np.float32)
    present = np.zeros(len(rows), dtype=bool)
    print(f"Streaming {KEYPOINTS} for {len(rows)} labeled clips", flush=True)
    with KEYPOINTS.open("rb") as f:
        for done, (attachment_id, frames) in enumerate(ijson.kvitems(f, ""), 1):
            index = by_id.get(attachment_id)
            if index is None:
                continue
            x[index] = sequence_features(frames)
            present[index] = True
            if done % 2000 == 0:
                print(f"FEATURES {done}", flush=True)
    y = np.asarray([label_index.get(row["text"].strip(), -1) for row in rows], dtype=np.int32)
    users = np.asarray([row["user_id"] for row in rows])
    metadata = {
        "source": "Slovo official MediaPipe landmark release",
        "annotationCount": len(rows),
        "keypointClips": int(present.sum()),
        "missingKeypoints": int((~present).sum()),
        "labelCount": len(labels),
        "featureShape": [16, 132],
        "framesPerClip": 16,
        "normalization": "wrist-centered palm-scaled landmarks plus wrist location, both hands",
    }
    np.savez_compressed(cache, x=x, y=y, users=users, labels=np.asarray(labels), metadata=json.dumps(metadata))
    return x, y, users, labels, metadata


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DATA / "slovo-word-candidate-v2")
    parser.add_argument("--cache", type=Path, default=DATA / "slovo-word-features-v2.npz")
    parser.add_argument("--max-iter", type=int, default=100)
    parser.add_argument(
        "--top-classes",
        type=int,
        default=1000,
        help="Train only the most frequent labels in the fit split (default: all labels).",
    )
    args = parser.parse_args()
    start = time.monotonic()
    rows = annotation_rows(ANNOTATIONS)
    x, y, users, labels, source_meta = load_features(rows, args.cache)
    has_keypoints = np.any(x != 0, axis=1)
    official_train = np.asarray([r["train"].strip().lower() == "true" for r in rows])
    official_test = ~official_train
    test_users = set(users[official_test])
    # The published CSV's train flag is not fully signer-disjoint in the
    # downloaded annotation file. Remove every training clip from any signer
    # also present in the official test partition before creating validation.
    clean_train = official_train & ~np.isin(users, list(test_users))
    val_users = {u for u in set(users[clean_train]) if signer_validation(str(u))}
    validation = clean_train & np.isin(users, list(val_users)) & has_keypoints
    fit = clean_train & ~np.isin(users, list(val_users)) & has_keypoints
    test = official_test & has_keypoints
    assert len(set(users[fit]) & set(users[validation])) == 0
    assert len(set(users[fit]) & set(users[validation])) == 0, "Fit/validation signer overlap"
    assert len(set(users[fit]) & set(users[test])) == 0, "Fit/test signer overlap"
    assert len(set(users[validation]) & set(users[test])) == 0, "Validation/test signer overlap"
    fit_counts = np.bincount(y[fit], minlength=len(labels))
    available = np.flatnonzero(fit_counts)
    if not 1 <= args.top_classes <= len(available):
        raise ValueError(f"--top-classes must be between 1 and {len(available)}")
    selected = available[np.argsort(fit_counts[available])[-args.top_classes:]]
    # Keep evaluation signer-disjoint and avoid counting labels the model was
    # never meant to recognize as errors in this intentionally narrow task.
    validation_candidates = int(validation.sum())
    test_candidates = int(test.sum())
    fit &= np.isin(y, selected)
    validation &= np.isin(y, selected)
    test &= np.isin(y, selected)

    mean = x[fit].mean(axis=0)
    std = np.maximum(x[fit].std(axis=0), 0.05)
    model = MLPClassifier(hidden_layer_sizes=(256, 128), alpha=0.5, max_iter=args.max_iter,
                          random_state=42, early_stopping=True, validation_fraction=0.12,
                          n_iter_no_change=12, batch_size=256, learning_rate_init=0.001)
    print(json.dumps({"fit": int(fit.sum()), "validation": int(validation.sum()), "test": int(test.sum()),
                      "classes": len(labels), "fitSigners": len(set(users[fit])),
                      "validationSigners": len(set(users[validation])), "testSigners": len(set(users[test]))}), flush=True)
    with threadpool_limits(limits=4):
        model.fit((x[fit] - mean) / std, y[fit])
        pv = model.predict_proba((x[validation] - mean) / std)
        pt = model.predict_proba((x[test] - mean) / std)

    yv, yt = y[validation], y[test]
    pred_v = model.classes_[pv.argmax(axis=1)]
    pred_t = model.classes_[pt.argmax(axis=1)]
    validation_metrics = {
        "top1": float(accuracy_score(yv, pred_v)),
        "top5": float(top_k_accuracy_score(yv, pv, k=min(5, len(model.classes_)), labels=model.classes_)),
        "macroTop1": float(np.mean([np.mean(pred_v[yv == cls] == cls) for cls in np.unique(yv)])),
    }
    test_metrics = {
        "top1": float(accuracy_score(yt, pred_t)),
        "top5": float(top_k_accuracy_score(yt, pt, k=min(5, len(model.classes_)), labels=model.classes_)),
        "macroTop1": float(np.mean([np.mean(pred_t[yt == cls] == cls) for cls in np.unique(yt)])),
    }
    args.output.mkdir(parents=True, exist_ok=True)
    labels_out = [labels[int(i)] for i in model.classes_]
    exported = {
        "version": 1,
        "kind": "slovo-isolated-word-keypoint-mlp",
        "labels": labels_out,
        "inputSize": int(x.shape[1]),
        "mean": mean.tolist(),
        "std": std.tolist(),
        "layers": [{"weights": w.T.tolist(), "bias": b.tolist(), "activation": "relu"}
                   for w, b in zip(model.coefs_[:-1], model.intercepts_[:-1])],
        "weights": model.coefs_[-1].T.tolist(),
        "bias": model.intercepts_[-1].tolist(),
        "source": "https://github.com/ai-forever/slovo",
    }
    (args.output / "classifier.json").write_text(json.dumps(exported, ensure_ascii=False))
    report = {
        "scope": f"isolated Slovo signs only; top {len(labels_out)} fit-split labels; not continuous phrases or RSL grammar",
        "source": source_meta,
        "split": {"fitClips": int(fit.sum()), "validationClips": int(validation.sum()),
                  "testClips": int(test.sum()), "fitSigners": len(set(users[fit])),
                  "validationSigners": len(set(users[validation])), "testSigners": len(set(users[test])),
                  "validationCoverage": float(validation.sum() / validation_candidates),
                  "testCoverage": float(test.sum() / test_candidates),
                  "validationCandidateClips": validation_candidates,
                  "testCandidateClips": test_candidates,
                  "officialTrainClipsDroppedForSignerOverlap": int((official_train & np.isin(users, list(test_users))).sum()),
                  "officialTestUsedOnlyOnce": True, "fitValidationTestSignerOverlap": 0},
        "model": {"hiddenLayers": [256, 128], "alpha": 0.5, "iterations": model.n_iter_},
        "validation": validation_metrics,
        "test": test_metrics,
        "trainingSeconds": round(time.monotonic() - start, 2),
        "limitations": [
            "The clip-level classes are isolated signs; no sentence translation is trained.",
            "Hand keypoints omit face, shoulders, and signing-space context.",
            "Metrics are from the dataset split, not live camera recordings or teaching validation.",
            "No candidate should be deployed unless it beats an appropriate baseline and is evaluated with fresh signers.",
        ],
    }
    (args.output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
