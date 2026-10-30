"""A traceable vocabulary of real Slovo videos, not generated RSL translations."""
from pathlib import Path
from remotezip import RemoteZip
import csv,json,hashlib,concurrent.futures,threading,shutil,cv2
ROOT=Path(__file__).resolve().parents[2];DATA=ROOT/'ml/rsl/data';DEST=ROOT/'frontend/public/research/rsl/words';DEST.mkdir(exist_ok=True)
rows=list(csv.DictReader((DATA/'slovo-annotations.csv').read_text().splitlines(),delimiter='\t'));lookup={r['text'].lower():r['text'] for r in rows}
groups={
'Общение':'я|ты|вы|мы|мой|твой|наш|меня|тебя|вам|нам|кто?|что|когда|почему|сколько|да|не|это|вопрос|имя|язык|помочь|спросить|ответить|показать|понять|сказать|говорить|слышать',
'Семья и люди':'семья|мать|отец|брат|сестра|сын|дочь|муж|жена|друг|подруга|ребёнок|человек|люди|мальчик|девочка|мужчина|женщина',
'Учёба':'школа|книга|карандаш|ручка|бумага|читать|писать|изучить|знать|обучать|слушать|смотреть|повторить|проверить|ошибка|память|думать|вспомнить|забыть',
'Каждый день':'дом|комната|город|улица|магазин|вода|хлеб|еда|есть|спать|работать|идти|ехать|жить|играть|любить|хотеть|дать|взять|открыть|закрыть|начать|закончить|ждать|найти|купить',
'Время':'сегодня|завтра|вчера|утро|день|вечер|ночь|час|минута|неделя|месяц|год|сейчас|потом|скоро|всегда|никогда|иногда|понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|лето|зима|осень|весна|еще нет|день и ночь|в этом году|в прошлом году',
'Числа':'ноль|один|два|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|двадцать|сто',
'Описание':'хороший|плохой|большой|маленький|новый|старый|быстрый|медленный|красивый|трудный|легкий|интересный|счастливый|грустный|спокойный|радость|страх|любовь',
'Цвета и животные':'цвет|красный|синий|зелёный|желтый|белый|черный|кошка|собака|птица|рыба|лошадь|животное'
}
overrides_path=ROOT/'ml/rsl/reference-overrides.json'
overrides=json.loads(overrides_path.read_text()) if overrides_path.exists() else {}
chosen=[]
for category,terms in groups.items():
 for term in terms.split('|'):
  if term not in lookup:print('NOT_IN_DATASET',term,flush=True);continue
  label=lookup[term];eligible=sorted([r for r in rows if r['text']==label and r['train']=='True'],key=lambda r:hashlib.sha256(r['attachment_id'].encode()).hexdigest());r=next((r for r in eligible if r['attachment_id']==overrides.get(label,{}).get('attachmentId')),eligible[0]);chosen.append(dict(r,category=category,stableId=overrides.get(label,{}).get('stableId')))
local=threading.local();URL='https://rndml-team-cv.obs.ru-moscow-1.hc.sbercloud.ru/datasets/slovo/slovo.zip'
def fetch(r):
 id=r['attachment_id'];dest=DEST/(id+'.mp4')
 if not dest.exists():
  if not getattr(local,'zip',None):local.zip=RemoteZip(URL,timeout=90)
  dest.write_bytes(local.zip.read('train/'+id+'.mp4'))
 poster=DEST/(id+'.jpg')
 if not poster.exists():
  cap=cv2.VideoCapture(str(dest));cap.set(cv2.CAP_PROP_POS_FRAMES,int(cap.get(cv2.CAP_PROP_FRAME_COUNT)*.5));ok,img=cap.read();cap.release()
  if ok:
   h,w=img.shape[:2];factor=min(1,480/max(w,h));cv2.imwrite(str(poster),cv2.resize(img,(int(w*factor),int(h*factor))),[cv2.IMWRITE_JPEG_QUALITY,80])
 return {'id':r.get('stableId') or 'word-'+id[:8],'label':r['text'],'category':r['category'],'video':'/research/rsl/words/'+dest.name,'poster':'/research/rsl/words/'+poster.name,'source':'https://github.com/ai-forever/slovo','dataset':'Slovo','attachmentId':id,'signerId':r['user_id']}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 entries=[]
 for e in pool.map(fetch,chosen):
  entries.append(e)
  if len(entries)%20==0:print('WORDS',len(entries),len(chosen),flush=True)
(DEST/'catalog.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2))
shutil.copyfile(DATA/'slovo-license.pdf',DEST/'license.pdf')
(DEST/'ATTRIBUTION.txt').write_text('Slovo: Russian Sign Language Dataset (2023). Authors: Alexander Kapitanov, Karina Kvanchiani, Alexander Nagaev, Elizaveta Petrova. Source: https://github.com/ai-forever/slovo . License: custom attribution/share-alike public license, full terms in license.pdf. Unmodified trimmed training videos; posters extracted and resized by AI Mentor. No endorsement. The same license applies to these adaptations. IDs and labels in catalog.json. Dataset samples are references, not certified teaching material.\n')
print('DICTIONARY_COMPLETE',len(entries),flush=True)
