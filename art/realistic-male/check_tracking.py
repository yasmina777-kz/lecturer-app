"""Automatic trust check for the avatar clips (no Blender needed).

The avatar is solved from MediaPipe landmarks of the reference video. Where the
tracker did not see a hand clearly, the solver has to invent the hand shape —
that is where the avatar shows wrong signs. Per clip, inside the sign itself
(catalog "core", the raised-hand part):
  * presence  — share of frames where each signing hand was detected;
  * max gap   — longest run without that hand (filled by interpolation);
  * conflicts — frames where both detections matched the same wrist or the
                detected hand is far from the body's wrist (swapped/lost hands);
  * jitter    — frame-to-frame fingertip jumps (unstable finger tracking).
A clip that fails is marked "auto-doubtful": learners see the real video, and
the review page lists it first for the consultant.
  python3 art/realistic-male/check_tracking.py   → frontend/public/avatars/alex/auto-check.json
"""
import json, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "ml/rsl/data/motion"
CAT = ROOT / "frontend/public/avatars/alex/catalog.json"
OUT = ROOT / "frontend/public/avatars/alex/auto-check.json"
TIPS = [4, 8, 12, 16, 20]


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def check(cap, core):
    frames = cap["frames"]
    t0 = frames[0]["t"] if frames else 0
    lo, hi = (core or [0, 1e9])
    inside = [f for f in frames if lo <= f["t"] - t0 <= hi and f.get("pose")]
    if len(inside) < 4:
        return {"ok": False, "reason": "мало кадров с телом"}
    side_frames = {"Left": [], "Right": []}
    conflicts = 0
    for f in inside:
        wl, wr = f["pose"][15], f["pose"][16]
        got = {"Left": None, "Right": None}
        clash = False
        for h in f.get("hands", []):
            p = h["image"][0]
            dl, dr = dist(p, wl), dist(p, wr)
            side = "Left" if dl < dr else "Right"
            if got[side] is not None or min(dl, dr) > 0.12:
                clash = True
            if got[side] is None:
                got[side] = h["image"]
        conflicts += clash
        for s in side_frames:
            side_frames[s].append(got[s])
    # A hand is signing if it is seen in a good part of the sign, or its wrist
    # is raised above the elbow for most of it.
    stats, used = {}, []
    for s, seq in side_frames.items():
        seen = [x is not None for x in seq]
        wrist, elbow = (15, 13) if s == "Left" else (16, 14)
        raised = sum(f["pose"][wrist][1] < f["pose"][elbow][1] for f in inside) / len(inside)
        presence = sum(seen) / len(seen)
        if presence < 0.25 and raised < 0.5:
            continue
        used.append(s)
        gap = run = 0
        for v in seen:
            run = 0 if v else run + 1
            gap = max(gap, run)
        jumps = []
        # Scale: the hand's typical size in this clip (a palm turned edge-on
        # looks short in one frame, which must not inflate the jitter).
        sizes = sorted(max(dist(h[0], h[k]) for k in (5, 9, 13, 17)) for h in seq if h is not None)
        size = sizes[len(sizes) // 2] if sizes else 1e-3
        for a, b in zip(seq, seq[1:]):
            if a is not None and b is not None:
                # Fingertips relative to the wrist: moving the whole hand is fine,
                # fingers jumping around the palm between frames is not.
                rel = lambda h, k: (h[k][0] - h[0][0], h[k][1] - h[0][1])
                jumps.append(max(dist(rel(a, k), rel(b, k)) for k in TIPS) / size)
        jitter = sorted(jumps)[int(len(jumps) * 0.9)] if len(jumps) >= 5 else 0.0
        stats[s] = {"presence": round(presence, 3), "maxGapSec": round(gap / max(1, cap.get("captureFps") or 20), 2), "jitter": round(jitter, 2)}
    if not used:
        return {"ok": False, "reason": "руки не найдены в жесте"}
    conflict = conflicts / len(inside)
    reasons = []
    for s in used:
        st = stats[s]
        name, gen = ("левая", "левой") if s == "Left" else ("правая", "правой")
        if st["presence"] < 0.7:
            reasons.append(f"{name} рука видна в {round(st['presence'] * 100)}% кадров")
        if st["maxGapSec"] > 0.4:
            reasons.append(f"{name} рука пропадает на {st['maxGapSec']} с")
        if st["jitter"] > 1.2:
            reasons.append(f"пальцы {gen} руки отслежены неустойчиво")
    if conflict > 0.2:
        reasons.append("руки путаются между собой")
    return {"ok": not reasons, "hands": stats, "conflict": round(conflict, 3), **({"reason": "; ".join(reasons)} if reasons else {})}


catalog = json.loads(CAT.read_text())
result, bad = {}, 0
for e in catalog:
    f = DATA / (e["id"] + ".json")
    if not f.exists():
        continue
    r = check(json.loads(f.read_text()), e.get("core"))
    result[e["id"]] = r
    bad += not r["ok"]
OUT.write_text(json.dumps({"method": "tracking-check-v1", "checked": len(result), "doubtful": bad, "clips": result}, ensure_ascii=False))
print("checked", len(result), "doubtful", bad)
from collections import Counter
print(sorted(r["hands"][s]["jitter"] for r in result.values() if "hands" in r for s in r["hands"])[::60])
print(Counter(part.split(" в ")[0].split(" на ")[0] for r in result.values() if not r["ok"] for part in r["reason"].split("; ")).most_common(8))
