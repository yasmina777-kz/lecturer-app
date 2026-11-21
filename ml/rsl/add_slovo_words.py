"""Add the Slovo words fetched by fetch_slovo_subset.py to the platform dictionary.

For every label: of the downloaded takes, keep the one where MediaPipe found the
hands in the most frames (slovo_mediapipe.json); make a compact 480p H.264 copy
and a poster; pick a category from the part of speech. Words whose Russian forms
already point at an existing sign (мне → «меня», этот, их …) are skipped: in
text-to-sign they would shadow the sign people already see.
  .venv/bin/python add_slovo_words.py
"""
import csv, json, subprocess
from pathlib import Path
import cv2, imageio_ffmpeg, pymorphy3

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "ml/rsl/data"
SRC = DATA / "slovo-new"
DEST = ROOT / "frontend/public/research/rsl/words"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
morph = pymorphy3.MorphAnalyzer()

rows = {r["attachment_id"]: r for r in csv.DictReader((DATA / "slovo-annotations.csv").open(), delimiter="\t")}
picks = json.loads((SRC / "picks.json").read_text())
catalog = json.loads((DEST / "catalog.json").read_text())
forms = json.loads((DEST / "forms.json").read_text())
have = {e["label"].lower().rstrip("!?") for e in catalog}
print("loading hand landmarks…", flush=True)
landmarks = json.loads((DATA / "slovo_mediapipe.json").read_text())


def coverage(aid):
    frames = landmarks.get(aid) or []
    return sum(1 for f in frames if f) / max(1, len(frames))


def category(label):
    w = label.lower().split()[0].strip("();,")
    tag = morph.parse(w)[0].tag
    if "ADJF" in tag or "ADJS" in tag or "PRTF" in tag:
        return "Описание"
    if "VERB" in tag or "INFN" in tag:
        return "Действия"
    if "NOUN" in tag:
        return "Понятия и предметы"
    return "Общение"


added, skipped = [], []
for label, ids in picks.items():
    low = label.lower().rstrip("!?")
    if low in have:
        continue
    if low in forms:  # its forms already show another sign
        skipped.append(label)
        continue
    takes = [a for a in ids if (SRC / f"{a}.mp4").exists()]
    if not takes:
        skipped.append(label)
        continue
    aid = max(takes, key=coverage)
    dest, poster = DEST / f"{aid}.mp4", DEST / f"{aid}.jpg"
    if not dest.exists():
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(SRC / f"{aid}.mp4"), "-an", "-vf",
                        "scale='if(gt(iw,ih),480,-2)':'if(gt(iw,ih),-2,480)'", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart", str(dest)], check=True)
    if not poster.exists():
        cap = cv2.VideoCapture(str(dest))
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(cap.get(cv2.CAP_PROP_FRAME_COUNT) * 0.5))
        ok, img = cap.read()
        cap.release()
        if ok:
            cv2.imwrite(str(poster), img, [cv2.IMWRITE_JPEG_QUALITY, 80])
    added.append({"id": "word-" + aid[:8], "label": label, "category": category(label),
                  "video": "/research/rsl/words/" + dest.name, "poster": "/research/rsl/words/" + poster.name,
                  "source": "https://github.com/ai-forever/slovo", "dataset": "Slovo", "attachmentId": aid,
                  "signerId": rows[aid]["user_id"]})
    have.add(low)
ids = {e["id"] for e in catalog}
clash = [e for e in added if e["id"] in ids]
assert not clash, f"id clash: {clash[:3]}"
(DEST / "catalog.json").write_text(json.dumps(catalog + added, ensure_ascii=False, indent=2))
size = sum((DEST / Path(e["video"]).name).stat().st_size for e in added)
print(f"ADDED {len(added)} words ({size / 1e6:.1f} MB), skipped {len(skipped)}: {skipped[:20]}; catalog now {len(catalog) + len(added)}")
