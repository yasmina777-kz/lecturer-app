"""Publish only clips successfully baked for Woman 01, with original comparison URLs."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'frontend/public/avatars/woman01'
source=json.loads((ROOT/'frontend/public/avatars/sign-motion/catalog.json').read_text())
assets=[]
for entry in source:
    stem=Path(entry['url']).stem;p=OUT/(stem+'.glb');report=OUT/(stem+'.json')
    if not p.exists() or not report.exists():continue
    info=json.loads(report.read_text())
    keep=['id','label','reference','source','sourceTimeline','sourceRecording','chartPose','leadIn','leadOut']
    asset={k:entry[k] for k in keep if k in entry}
    asset.update(url='/avatars/woman01/'+p.name,originalUrl=entry['url'],duration=info['duration'],revision=hashlib.sha256(p.read_bytes()).hexdigest()[:12],review='experimental-unreviewed')
    assets.append(asset)
for stem,label in [('fist','Тест: сжатие кулака'),('point','Тест: указательный жест'),('pinch','Тест: щипок'),('wave','Тест: взмах рукой'),('grasp','Тест: захват')]:
    p=OUT/(stem+'.glb');info=json.loads((OUT/(stem+'.json')).read_text())
    assets.append(dict(id='trial-'+stem,label=label,url='/avatars/woman01/'+p.name,originalUrl='/avatars/hand-workshop/'+p.name,duration=info['duration'],revision=hashlib.sha256(p.read_bytes()).hexdigest()[:12],review='mechanical-study'))
(OUT/'catalog.json').write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':')))
print(f'{len(assets)} catalog entries; {len(source)} original entries')
