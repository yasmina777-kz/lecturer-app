"""Publish the avatar clips that were baked successfully (same ids as the shared library)."""
import hashlib, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend/public/avatars/alex"
source = json.loads((ROOT / "frontend/public/avatars/sign-motion/catalog.json").read_text())
assets = []
for entry in source:
    stem = Path(entry["url"]).stem
    glb, info = OUT / (stem + ".glb"), OUT / (stem + ".json")
    if not glb.exists() or not info.exists():
        continue
    meta = json.loads(info.read_text())
    assets.append(dict(id=entry["id"], label=entry["label"], url="/avatars/alex/" + glb.name, originalUrl=entry["url"],
                       duration=meta["duration"], revision=hashlib.sha256(glb.read_bytes()).hexdigest()[:12], review="retargeted-unreviewed"))
(OUT / "catalog.json").write_text(json.dumps(assets, ensure_ascii=False, separators=(",", ":")))
print(f"{len(assets)} of {len(source)} signs on the avatar")
