"""Fingerspelling sets for the reading trainer: for one Bukva signer who signed all
33 letters, each letter cut to its annotated span (begin..end, ±3 frames) as a
small H.264 clip. Two signers with the best hand tracking are exported.
  .venv/bin/python -I export_fingerspell.py → frontend/public/research/rsl/fingerspell/"""
import collections, json, subprocess
from pathlib import Path
import numpy as np, imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'ml/rsl/data/alphabet'
OUT = ROOT / 'frontend/public/research/rsl/fingerspell'
FF = imageio_ffmpeg.get_ffmpeg_exe()
LETTERS = list('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ')
rows = json.load(open(SRC / 'manifest.json'))
by = collections.defaultdict(dict)
for r in rows:
    if r['text'] in LETTERS and (SRC / (r['attachment_id'] + '.mp4')).exists() and r['height'] == '1920' and r['width'] == '1080':
        by[r['user_id']][r['text']] = r


def quality(user):
    vals = []
    for r in by[user].values():
        f = SRC / 'features-v5' / (r['attachment_id'] + '.npz')
        if not f.exists():
            return 0
        fr = np.load(f)['frames']; a, b = int(r['begin']), int(r['end'])
        seg = fr[a:b + 1, 65]
        vals.append(float((seg > 0).mean()) if len(seg) else 0.0)
    return min(vals) * .5 + float(np.mean(vals)) * .5


full = sorted([u for u, d in by.items() if len(d) == 33], key=quality, reverse=True)[:2]
manifest = {}
for k, user in enumerate(full):
    sid = f'signer{k + 1}'
    d = OUT / sid; d.mkdir(parents=True, exist_ok=True)
    letters = {}
    for L, r in by[user].items():
        a, b = max(0, int(r['begin']) - 3), int(r['end']) + 3
        out = d / f'{LETTERS.index(L):02d}.mp4'
        # upper body: y 8%..78% of the 1080x1920 frame, scaled to 360x468
        subprocess.run([FF, '-y', '-loglevel', 'error', '-i', str(SRC / (r['attachment_id'] + '.mp4')), '-an', '-vf',
                        f"select='between(n,{a},{b})',setpts=N/30/TB,crop=1080:1344:0:154,scale=360:448",
                        '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-preset', 'slow', '-movflags', '+faststart', str(out)], check=True)
        letters[L] = {'file': f'/research/rsl/fingerspell/{sid}/{out.name}', 'frames': b - a + 1, 'attachmentId': r['attachment_id']}
    manifest[sid] = {'quality': round(quality(user), 3), 'letters': letters}
    print('SIGNER', sid, manifest[sid]['quality'], sum((d / f'{i:02d}.mp4').stat().st_size for i in range(33)) // 1024, 'KB')
(OUT / 'manifest.json').write_text(json.dumps({'source': 'Bukva (ai-forever), letters cut to their annotated spans; see /research/rsl/ATTRIBUTION.txt', 'signers': manifest}, ensure_ascii=False, indent=1))
