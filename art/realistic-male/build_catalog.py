"""Publish every clip baked for Alex: solved from video (video-solve-v1) or retargeted."""
import hashlib, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend/public/avatars/alex"
shared = {Path(e["url"]).stem: e for e in json.loads((ROOT / "frontend/public/avatars/sign-motion/catalog.json").read_text())}
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
                       review="unreviewed"))
(OUT / "catalog.json").write_text(json.dumps(assets, ensure_ascii=False, separators=(",", ":")))
solved = sum(a["method"] == "video-solve-v1" for a in assets)
print(f"{len(assets)} clips ({solved} solved from video)")
