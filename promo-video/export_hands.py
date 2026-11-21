"""Real hand landmarks (Slovo, signer-disjoint public dataset) for the promo
video's point-hand animations → build/hands/<name>.json  {w,h,frames:[[hand[[x,y]*21]]]}
  ml/rsl/.venv/bin/python promo-video/export_hands.py"""
import csv, json
from pathlib import Path
import ijson

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'ml/rsl/data'
WANT = {'Привет!': 'privet', 'дом': 'dom'}
rows = [r for r in csv.DictReader((DATA / 'slovo-annotations.csv').read_text().splitlines(), delimiter='\t') if r['text'] in WANT]
cands = {r['attachment_id']: r for r in rows}
best = {}
with (DATA / 'slovo_mediapipe.json').open('rb') as f:
    for aid, frames in ijson.kvitems(f, '', use_float=True):
        r = cands.get(aid)
        if not r:
            continue
        hands = [[[[round(p['x'], 4), round(p['y'], 4)] for p in pts] for _, pts in (fr or {}).items() if isinstance(pts, list) and len(pts) == 21] for fr in frames]
        cover = sum(1 for h in hands if h) / max(1, len(hands))
        two = sum(1 for h in hands if len(h) == 2) / max(1, len(hands))
        score = cover + .3 * two
        if cover > .8 and len(hands) >= 40 and int(r['height']) > int(r['width']) and score > best.get(r['text'], (0,))[0]:
            best[r['text']] = (score, aid, int(r['width']), int(r['height']), hands)
for text, (score, aid, w, h, hands) in best.items():
    (ROOT / f'promo-video/build/hands/{WANT[text]}.json').write_text(json.dumps({'w': w, 'h': h, 'frames': hands, 'source': f'Slovo {aid}'}))
    print('HANDS', text, aid, len(hands), 'frames', round(score, 2))
