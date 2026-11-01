"""Download a reproducible all-letter Bukva subset; official signer splits unchanged."""
from pathlib import Path
from remotezip import RemoteZip
import csv,json,hashlib,concurrent.futures,threading,time,argparse
HERE=Path(__file__).resolve().parent; DATA=HERE/'data'; DEST=DATA/'alphabet';DEST.mkdir(exist_ok=True)
URL='https://rndml-team-cv.obs.ru-moscow-1.hc.sbercloud.ru/datasets/bukva/bukva.zip'
rows=list(csv.DictReader((DATA/'annotations.tsv').read_text().splitlines(),delimiter='\t'))
parser=argparse.ArgumentParser()
parser.add_argument('--train-per-class',type=int,default=45)
args=parser.parse_args()
assert args.train_per_class>0
labels=list('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ')+['no_event'];chosen=[]
for label in labels:
 for split,limit in [('True',args.train_per_class),('False',18)]:
  eligible=sorted([r for r in rows if r['text']==label and r['train']==split],key=lambda r:hashlib.sha256(r['attachment_id'].encode()).hexdigest())
  chosen+=eligible[:limit]
(DEST/'manifest.json').write_text(json.dumps(chosen,ensure_ascii=False,indent=2))
local=threading.local()
def fetch(r):
 name=r['attachment_id']+'.mp4';dest=DEST/name
 if dest.exists():return
 old=DATA/name
 if old.exists():dest.hardlink_to(old);return
 for attempt in range(4):
  try:
   if not getattr(local,'zip',None):local.zip=RemoteZip(URL,timeout=90)
   data=local.zip.read('trimmed/'+name);tmp=dest.with_suffix('.part');tmp.write_bytes(data);tmp.replace(dest);return
  except Exception:
   if getattr(local,'zip',None):local.zip.close();local.zip=None
   if attempt==3:raise
   time.sleep(attempt+1)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for i,_ in enumerate(pool.map(fetch,chosen)):
  if i%50==0:print(i+1,len(chosen),flush=True)
print('DOWNLOAD_COMPLETE',len(chosen),flush=True)
