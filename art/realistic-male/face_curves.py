"""Facial animation for Alex's clips from the video blendshapes (ml/rsl/capture_face.py).

  python3 art/realistic-male/face_curves.py      (system python is enough: json + math only)

Timing matches solve_video.py exactly: 30 fps from the first frame with a body pose,
plus the same 0.15 s relaxed hold at both ends and the same 0.35 s ease. Each signer's
resting face (10th percentile per unit) is subtracted so personal resting expressions
are not copied; values are smoothed, gently amplified and clamped to 0..1.
Output: frontend/public/avatars/alex/<id>.face.json
"""
import json, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MOTION = ROOT / "ml/rsl/data/motion"
FACE = ROOT / "ml/rsl/data/face"
OUT = ROOT / "frontend/public/avatars/alex"
FPS = 30
HOLD = int(0.15 * FPS)
GAIN = {"jawOpen": 1.3, "mouthFunnel": 1.3, "mouthPucker": 1.2, "browInnerUp": 1.4, "browOuterUpLeft": 1.3,
        "browOuterUpRight": 1.3, "browDownLeft": 1.3, "browDownRight": 1.3}
SKIP = {"_neutral", "eyeLookDownLeft", "eyeLookDownRight", "eyeLookInLeft", "eyeLookInRight", "eyeLookOutLeft",
        "eyeLookOutRight", "eyeLookUpLeft", "eyeLookUpRight", "tongueOut"}


def interp(ts, vs, t):
    if t <= ts[0]:
        return vs[0]
    if t >= ts[-1]:
        return vs[-1]
    lo, hi = 0, len(ts) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if ts[mid] <= t:
            lo = mid
        else:
            hi = mid
    a = (t - ts[lo]) / max(ts[hi] - ts[lo], 1e-9)
    return vs[lo] + a * (vs[hi] - vs[lo])


def smooth(v, sigma=1.5):
    r = int(3 * sigma)
    k = [math.exp(-0.5 * (i / sigma) ** 2) for i in range(-r, r + 1)]
    s = sum(k)
    out = []
    for i in range(len(v)):
        acc = 0.0
        for j, w in zip(range(i - r, i + r + 1), k):
            acc += w * v[min(len(v) - 1, max(0, j))]
        out.append(acc / s)
    return out


done = 0
for mpath in sorted(MOTION.glob("*.json")):
    fpath = FACE / mpath.name
    if not fpath.exists() or not (OUT / (mpath.stem + ".glb")).exists():
        continue
    motion = json.loads(mpath.read_text())
    frames = [f for f in motion["frames"] if f.get("world")]
    if len(frames) < 4:
        continue
    t0, t1 = frames[0]["t"], frames[-1]["t"]
    n = int(math.floor((t1 - t0) * FPS + 1e-6)) + 1
    tdst = [t0 + k / FPS for k in range(n)]
    face = [f for f in json.loads(fpath.read_text())["frames"] if f["face"]]
    if len(face) < 4:
        continue
    ts = [f["t"] for f in face]
    units = [u for u in face[0]["face"] if u not in SKIP]
    ease = min(int(0.35 * FPS), n // 3)
    curves = {}
    for u in units:
        raw = [f["face"].get(u, 0.0) for f in face]
        base = sorted(raw)[int(0.1 * (len(raw) - 1))]
        vals = smooth([interp(ts, raw, t) for t in tdst])
        g = GAIN.get(u, 1.15)
        vals = [min(1.0, max(0.0, (v - base) * g)) for v in vals]
        for i in range(n):
            w = 1.0
            if i < ease:
                w = i / ease
            if i >= n - ease:
                w = min(w, (n - 1 - i) / ease)
            vals[i] *= w * w * (3 - 2 * w)
        if max(vals) >= 0.08:
            curves[u] = [0.0] * HOLD + [round(v, 2) for v in vals] + [0.0] * HOLD
    (OUT / (mpath.stem + ".face.json")).write_text(json.dumps({"fps": FPS, "frames": n + 2 * HOLD, "curves": curves}, separators=(",", ":")))
    done += 1
print("FACE_CURVES", done)
