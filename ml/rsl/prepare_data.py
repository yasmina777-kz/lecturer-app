"""Download a deterministic small Bukva subset using HTTP ranges, not the 27 GB archive."""
from pathlib import Path
from remotezip import RemoteZip
import csv,json,hashlib
ROOT=Path(__file__).resolve().parent
DATA=ROOT/'data'; DATA.mkdir(exist_ok=True)
URL='https://rndml-team-cv.obs.ru-moscow-1.hc.sbercloud.ru/datasets/bukva/bukva.zip'
with RemoteZip(URL,timeout=90) as z:
 annotation=z.read('annotations.tsv');(DATA/'annotations.tsv').write_bytes(annotation)
 rows=list(csv.DictReader(annotation.decode().splitlines(),delimiter='\t'))
 chosen=[]
 for label in ['А','В','Л']:
  for split,limit in [('True',45),('False',18)]:
   eligible=sorted([r for r in rows if r['text']==label and r['train']==split],key=lambda r:hashlib.sha256(r['attachment_id'].encode()).hexdigest())
   chosen+=eligible[:limit]
 (DATA/'manifest.json').write_text(json.dumps(chosen,ensure_ascii=False,indent=2))
 for i,r in enumerate(chosen):
  name=r['attachment_id']+'.mp4';dest=DATA/name
  if not dest.exists():dest.write_bytes(z.read('trimmed/'+name))
  print(f'{i+1}/{len(chosen)} {r["text"]} {r["train"]}',flush=True)
 print('bytes',sum((DATA/(r['attachment_id']+'.mp4')).stat().st_size for r in chosen))
