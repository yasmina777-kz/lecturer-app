"""Let recognition answer with every dictionary word the model knows (courseLabels).
The word models were trained on all 1000 Slovo signs; course mode only restricts
the answer to signs that the platform teaches."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
cat = json.loads((ROOT / "frontend/public/research/rsl/words/catalog.json").read_text())
labels = {e["label"] for e in cat}
for p in sorted((ROOT / "frontend/public/models/rsl").glob("words-v4*classifier.json")):
    m = json.loads(p.read_text())
    before = len(m.get("courseLabels", []))
    m["courseLabels"] = [l for l in m["labels"] if l in labels]
    p.write_text(json.dumps(m, ensure_ascii=False, separators=(",", ":")))
    print(p.name, before, "->", len(m["courseLabels"]))
