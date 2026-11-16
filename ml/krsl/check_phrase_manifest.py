"""Preflight a consented, signer-disjoint dataset for a closed RSL intent pilot.

This validates data only. It does not train a model or establish that a prompt is
grammatically correct in RSL; a qualified reviewer must approve every meaning.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INTENTS = ROOT / "phrase-intents.json"


def inspect(path: Path) -> dict:
    catalog = json.loads(INTENTS.read_text(encoding="utf-8"))
    intent_ids = {item["id"] for item in catalog["intents"]}
    rows = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(rows, list) or not rows:
        raise ValueError("Manifest must be a non-empty JSON array")

    seen_hashes: set[str] = set()
    group_split: dict[str, str] = {}
    counts = defaultdict(lambda: defaultdict(int))
    signers = defaultdict(lambda: defaultdict(set))
    for index, row in enumerate(rows, 1):
        if not isinstance(row, dict):
            raise ValueError(f"Row {index}: expected an object")
        intent = row.get("intentId")
        if intent not in intent_ids:
            raise ValueError(f"Row {index}: unknown intentId {intent!r}")
        split = row.get("split")
        if split not in {"train", "val", "test"}:
            raise ValueError(f"Row {index}: split must be train, val, or test")
        signer = row.get("signerId")
        if not isinstance(signer, str) or not signer.strip():
            raise ValueError(f"Row {index}: signerId is required")
        if group_split.setdefault(signer, split) != split:
            raise ValueError(f"Signer leakage: {signer!r} appears in multiple splits")
        if row.get("consentForTraining") is not True:
            raise ValueError(f"Row {index}: explicit consentForTraining=true is required")
        reviewer = row.get("meaningReviewedBy")
        if not isinstance(reviewer, str) or not reviewer.strip():
            raise ValueError(f"Row {index}: meaningReviewedBy is required")
        video_value = row.get("video")
        if not isinstance(video_value, str) or not video_value.strip():
            raise ValueError(f"Row {index}: video path is required")
        video = (path.parent / video_value).resolve()
        if not video.is_file():
            raise ValueError(f"Row {index}: video not found: {video}")
        hasher = hashlib.sha256()
        with video.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                hasher.update(chunk)
        digest = hasher.hexdigest()
        if digest in seen_hashes:
            raise ValueError(f"Row {index}: duplicate video content")
        seen_hashes.add(digest)
        counts[intent][split] += 1
        signers[intent][split].add(signer)

    minimum_signers = {"train": 5, "val": 2, "test": 2}
    per_intent = {}
    ready = True
    for intent in sorted(intent_ids):
        per_intent[intent] = {
            split: {"clips": counts[intent][split], "signers": len(signers[intent][split])}
            for split in ("train", "val", "test")
        }
        if any(len(signers[intent][split]) < minimum_signers[split]
               for split in ("train", "val", "test")):
            ready = False

    return {
        "scope": catalog["scope"],
        "recordings": len(rows),
        "uniqueSigners": len(group_split),
        "signerDisjoint": True,
        "allClipsConsentedAndReviewed": True,
        "minimumSignersPerIntentAndSplit": minimum_signers,
        "readyForModelTraining": ready,
        "intents": per_intent,
        "note": "Passing this preflight does not certify recognition quality or RSL grammar.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="JSON array of consented reviewed recordings")
    args = parser.parse_args()
    report = inspect(args.manifest.resolve())
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report["readyForModelTraining"]:
        raise SystemExit("Dataset is not yet large enough for the signer-disjoint pilot gate")


if __name__ == "__main__":
    main()
