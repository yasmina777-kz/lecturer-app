"""Publish every clip baked for Alex: solved from video (video-solve-v1) or retargeted."""
import hashlib, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend/public/avatars/alex"
shared = {Path(e["url"]).stem: e for e in json.loads((ROOT / "frontend/public/avatars/sign-motion/catalog.json").read_text())}
HOLD, TRANS, FPS = 3, 9, 30
MOTION = ROOT / "ml/rsl/data/motion"


def core(stem):
    """Seconds of the clip where a hand is raised (the sign itself, without the
    signer lifting and lowering the arm). Used to chain letters smoothly."""
    path = MOTION / (stem + ".json")
    if not path.exists():
        return None
    frames = [f for f in json.loads(path.read_text())["frames"] if f.get("world") and f.get("pose")]
    if len(frames) < 4:
        return None
    t0 = frames[0]["t"]
    up = []
    for f in frames:
        p = f["pose"]
        sh = (p[11][1] + p[12][1]) / 2
        hip = (p[23][1] + p[24][1]) / 2
        line = sh + 0.3 * (hip - sh)
        if min(p[15][1], p[16][1]) < line:
            up.append(f["t"] - t0)
    if not up:
        # Signs made low (at the waist): the sign is where a hand is clearly
        # higher than at the clip's start and end.
        ys = [min(f["pose"][15][1], f["pose"][16][1]) for f in frames]
        p0 = frames[0]["pose"]
        span = max(((p0[23][1] + p0[24][1]) - (p0[11][1] + p0[12][1])) / 2, 0.05)
        rest = (sum(ys[:3]) / 3 + sum(ys[-3:]) / 3) / 2
        up = [f["t"] - t0 for f, y in zip(frames, ys) if y < rest - 0.08 * span]
    if not up:
        return None
    off = (HOLD + TRANS) / FPS
    return [round(off + max(0.0, up[0] - 0.08), 3), round(off + up[-1] + 0.08, 3)]


assets = []
for info in sorted(OUT.glob("*.json")):
    if info.name in ("catalog.json", "ready-idle.json"):
        continue
    glb = info.with_suffix(".glb")
    if not glb.exists():
        continue
    meta = json.loads(info.read_text())
    src = shared.get(info.stem, {})
    assets.append(dict(id=src.get("id", info.stem), label=meta.get("label") or src.get("label", info.stem),
                       url="/avatars/alex/" + glb.name, originalUrl=src.get("url", ""), duration=round(meta["duration"], 4),
                       revision=hashlib.sha256(glb.read_bytes()).hexdigest()[:12], method=meta.get("method", "retarget-v1"),
                       review="unreviewed", core=core(info.stem)))
(OUT / "catalog.json").write_text(json.dumps(assets, ensure_ascii=False, separators=(",", ":")))
solved = sum(a["method"] == "video-solve-v1" for a in assets)
print(f"{len(assets)} clips ({solved} solved from video)")
