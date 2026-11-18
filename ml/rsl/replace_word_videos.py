"""Replace badly framed dictionary videos with better Slovo takes of the same sign.
Candidates are ranked by hand-keypoint coverage, then downloaded, framing-checked
(audit_word_videos.framing) and re-encoded like the rest of the dictionary."""
import csv, json, hashlib, subprocess
from pathlib import Path
import ijson, imageio_ffmpeg, numpy as np, cv2
from remotezip import RemoteZip
from audit_word_videos import framing
ROOT = Path(__file__).resolve().parents[2]; DATA = ROOT / 'ml/rsl/data'
DEST = ROOT / 'frontend/public/research/rsl/words'
URL = 'https://rndml-team-cv.obs.ru-moscow-1.hc.sbercloud.ru/datasets/slovo/slovo.zip'
bad = json.loads((DATA / 'word-video-audit.json').read_text())
labels = {b['label'] for b in bad}
rows = [r for r in csv.DictReader((DATA / 'slovo-annotations.csv').read_text().splitlines(), delimiter='\t') if r['text'] in labels and r['train'] == 'True']
ids = {r['attachment_id']: r for r in rows}
cov = {}
with (DATA / 'slovo_mediapipe.json').open('rb') as f:
    for cid, frames in ijson.kvitems(f, '', use_float=True):
        if cid in ids:
            n = max(1, len(frames)); cov[cid] = sum(1 for fr in frames if fr) / n
tmp = DATA / 'word-candidates'; tmp.mkdir(exist_ok=True)
ff = imageio_ffmpeg.get_ffmpeg_exe()
cat = json.loads((DEST / 'catalog.json').read_text())
MOTION_IDS = {m['id'] for m in json.loads((ROOT / 'frontend/public/avatars/sign-motion/catalog.json').read_text()) if m.get('reference')}
report = []
with RemoteZip(URL, timeout=90) as z:
    for b in bad:
        cands = sorted((r for r in rows if r['text'] == b['label'] and r['attachment_id'] != b['attachmentId']),
                       key=lambda r: (-cov.get(r['attachment_id'], 0), hashlib.sha256(r['attachment_id'].encode()).hexdigest()))[:6]
        chosen = None
        for r in cands:
            raw = tmp / (r['attachment_id'] + '.mp4')
            if not raw.exists(): raw.write_bytes(z.read('train/' + r['attachment_id'] + '.mp4'))
            ok, why = framing(raw)
            if ok: chosen = r; break
        if not chosen:
            report.append(dict(label=b['label'], replaced=False)); continue
        cid = chosen['attachment_id']; out = DEST / (cid + '.mp4'); poster = DEST / (cid + '.jpg')
        subprocess.run([ff, '-y', '-loglevel', 'error', '-i', str(tmp / (cid + '.mp4')), '-an', '-vf', "scale='if(gt(iw,ih),480,-2)':'if(gt(iw,ih),-2,480)'",
                        '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(out)], check=True)
        cap = cv2.VideoCapture(str(out)); cap.set(1, int(cap.get(7) * .5)); ok, img = cap.read(); cap.release()
        if ok: cv2.imwrite(str(poster), img, [cv2.IMWRITE_JPEG_QUALITY, 80])
        for e in cat:
            if e['id'] == b['id']:
                # keep `video` when it is the source of a 3D motion clip; show the better take
                key = 'displayVideo' if e.get('displayVideo') or e['id'] in MOTION_IDS else 'video'
                e[key] = '/research/rsl/words/' + out.name
                e['displayPoster' if key == 'displayVideo' else 'poster'] = '/research/rsl/words/' + poster.name
                if key == 'video': e.update(attachmentId=cid, signerId=chosen['user_id'])
        report.append(dict(label=b['label'], replaced=True, why_old=b['why'], new=cid))
(DEST / 'catalog.json').write_text(json.dumps(cat, ensure_ascii=False, indent=2))
(DATA / 'word-video-replacements.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))
print(sum(r['replaced'] for r in report), 'of', len(report), 'replaced')
