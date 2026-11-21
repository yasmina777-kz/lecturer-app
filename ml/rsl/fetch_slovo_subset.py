"""Download only the Slovo videos we need, straight out of the official 16 GB zip,
with HTTP range requests (no full download).

  .venv/bin/python fetch_slovo_subset.py [per_label=2]

Picks, for every Slovo word that is not yet on the platform (letters excluded),
`per_label` takes from different signers, preferring vertical FullHD clips of
typical length. Output: data/slovo-new/<attachment_id>.mp4 + picks.json
"""
import csv, json, struct, sys, zlib, urllib.request
from pathlib import Path

URL = "https://rndml-team-cv.obs.ru-moscow-1.hc.sbercloud.ru/datasets/slovo/slovo.zip"
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "ml/rsl/data"
OUT = DATA / "slovo-new"
OUT.mkdir(parents=True, exist_ok=True)
PER = int(sys.argv[1]) if len(sys.argv) > 1 else 2


import subprocess


def get(start, end):
    # System curl: it verifies the server's certificate against the macOS keychain.
    for attempt in range(4):
        r = subprocess.run(["curl", "-sSf", "--max-time", "180", "-r", f"{start}-{end}", URL], capture_output=True)
        if r.returncode == 0 and len(r.stdout) == end - start + 1:
            return r.stdout
    raise RuntimeError(f"range {start}-{end} failed: {r.stderr[:200]}")


def size():
    r = subprocess.run(["curl", "-sSfI", URL], capture_output=True, text=True, check=True)
    return int(next(l.split(":")[1] for l in r.stdout.splitlines() if l.lower().startswith("content-length")))


def central_directory():
    total = size()
    tail = get(total - 65536 - 22, total - 1)
    i = tail.rfind(b"PK\x05\x06")
    cd_size, cd_off = struct.unpack("<II", tail[i + 12:i + 20])
    entries_total = struct.unpack("<H", tail[i + 10:i + 12])[0]
    if cd_off == 0xFFFFFFFF or cd_size == 0xFFFFFFFF or entries_total == 0xFFFF:
        j = tail.rfind(b"PK\x06\x07")
        z64_off = struct.unpack("<Q", tail[j + 8:j + 16])[0]
        z64 = get(z64_off, z64_off + 55)
        cd_size, cd_off = struct.unpack("<QQ", z64[40:56])
    cd = get(cd_off, cd_off + cd_size - 1)
    entries, p = {}, 0
    while p + 46 <= len(cd) and cd[p:p + 4] == b"PK\x01\x02":
        method = struct.unpack("<H", cd[p + 10:p + 12])[0]
        csize, usize = struct.unpack("<II", cd[p + 20:p + 28])
        nlen, elen, clen = struct.unpack("<HHH", cd[p + 28:p + 34])
        off = struct.unpack("<I", cd[p + 42:p + 46])[0]
        name = cd[p + 46:p + 46 + nlen].decode("utf-8", "replace")
        extra = cd[p + 46 + nlen:p + 46 + nlen + elen]
        q = 0
        while q + 4 <= len(extra):  # zip64 extended info
            hid, hlen = struct.unpack("<HH", extra[q:q + 4])
            if hid == 1:
                vals, k = [], q + 4
                for flag in (usize == 0xFFFFFFFF, csize == 0xFFFFFFFF, off == 0xFFFFFFFF):
                    if flag:
                        vals.append(struct.unpack("<Q", extra[k:k + 8])[0]); k += 8
                    else:
                        vals.append(None)
                usize = vals[0] or usize; csize = vals[1] or csize; off = vals[2] or off
            q += 4 + hlen
        entries[Path(name).stem] = (name, method, csize, off)
        p += 46 + nlen + elen + clen
    return entries


def fetch(entry, dest):
    name, method, csize, off = entry
    head = get(off, off + 29)
    nlen, elen = struct.unpack("<HH", head[26:30])
    data_start = off + 30 + nlen + elen
    blob = get(data_start, data_start + csize - 1)
    if method == 8:
        blob = zlib.decompress(blob, -15)
    dest.write_bytes(blob)
    return len(blob)


rows = list(csv.DictReader((DATA / "slovo-annotations.csv").open(), delimiter="\t"))
have = {e["label"].lower().rstrip("!?") for e in json.loads((ROOT / "frontend/public/research/rsl/words/catalog.json").read_text())}
want = sorted({r["text"] for r in rows if r["text"] != "no_event" and len(r["text"]) > 1 and r["text"].lower().rstrip("!?") not in have})
print("labels to add:", len(want), flush=True)


def rank(r):
    h, w, n = int(r["height"]), int(r["width"]), float(r["length"])
    return (h > w, min(h, w) >= 1080, -abs(n - 55))


picks = {}
for label in want:
    cands = sorted([r for r in rows if r["text"] == label], key=rank, reverse=True)
    chosen, users = [], set()
    for r in cands:
        if r["user_id"] in users:
            continue
        chosen.append(r["attachment_id"]); users.add(r["user_id"])
        if len(chosen) == PER:
            break
    picks[label] = chosen

entries = central_directory()
print("zip entries:", len(entries), flush=True)
done = total = 0
for label, ids in picks.items():
    for a in ids:
        dest = OUT / f"{a}.mp4"
        if dest.exists() and dest.stat().st_size > 0:
            continue
        if a not in entries:
            print("not in zip", label, a, flush=True)
            continue
        total += fetch(entries[a], dest)
        done += 1
        if done % 50 == 0:
            print(f"fetched {done} files, {total / 1e6:.0f} MB", flush=True)
(OUT / "picks.json").write_text(json.dumps(picks, ensure_ascii=False, indent=1))
print(f"DONE {done} new files, {total / 1e6:.0f} MB", flush=True)
