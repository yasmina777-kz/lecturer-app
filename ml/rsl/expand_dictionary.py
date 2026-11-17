"""(Forms of already animated words such as мне/тебе/нас/вас, and words whose forms collide
with animated ones (мыть→«моя», этот, их, другой), are left out: they
would shadow the animated sign in text-to-sign.)
Add more real Slovo reference videos to the course dictionary.

Existing catalog entries are kept unchanged (ids, videos). New entries use a
compact 480p H.264 copy of one training clip per sign plus a poster frame.
Every term must exist verbatim in the Slovo annotations; nothing is invented.
"""
import concurrent.futures
import csv
import hashlib
import json
import subprocess
import threading
from pathlib import Path

import cv2
import imageio_ffmpeg
from remotezip import RemoteZip

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'ml/rsl/data'
DEST = ROOT / 'frontend/public/research/rsl/words'
URL = 'https://rndml-team-cv.obs.ru-moscow-1.hc.sbercloud.ru/datasets/slovo/slovo.zip'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# Category -> Slovo labels (exact spelling from the annotations).
GROUPS = {
    'Общение': 'Пока|Добро пожаловать!|Прощание|С днем рождения|конечно|возможно|'
               'очень|много|немного|тоже|уже|еще|здесь|там|сейчас|теперь|сначала|затем; потом|или|если|'
               'ваш|все|слово|верить|доверять|обещать|встретить',
    'Семья и люди': 'жизнь|молодой|друг|народ|никто|повар|официант|женат|замужем|гений|трус',
    'Учёба': 'письмо|газета|новости|картина|календарь|расписание|переводить|искать|использовать|изменить|'
             'видеть|делать|делать выводы|первый|второй|третий|последний|следующий|начинать|продолжить',
    'Каждый день': 'пить|петь|платить|продать|получить|принести|положить|держать|стоять|лежать|'
                   'остаться|остановиться|путешествовать|путешествие|прийти|посылать|терять|упасть|'
                   'одежда|сумка|чемодан|ключ|деньги|Рубль|цена|билет|дорога|место|вещь',
    'Еда и места': 'кафе|ресторан|обедать|ланч|прием пищи|вкусный|голодный|Соль|Чашка|кружка|бутылка|'
                   'вилка|питьевая вода|диета|Жарить|кормить|заказывать|зоопарк|Футбол',
    'Тело и здоровье': 'голова|Лицо|глаз|рот|зубы|рука|нога|сердце|боль|болит|Витамин|сильный|слабый|'
                       'чистый|грязный|плакать|смеяться|спать',
    'Чувства': 'рад|счастье|радостный|грустный|злой|гнев|бояться|испуганный|удивлён|беспокоиться|'
               'нравиться|ненавидеть|надеяться|чувствовать|скучный|смешной|спокойный|уверенный|'
               'устал|стыдно|сожалеть|любопытный|добрый|милый',
    'Время': 'время|выходные|рано|поздно|часто|редко|обычно|всегда|никогда|однажды|наконец|'
             'будущее|август|октябрь|ноябрь|декабрь|2 часа|6 часов',
    'Числа': 'тринадцать|четырнадцать|пятнадцать|шестнадцать|семнадцать|восемнадцать|девятнадцать|'
             'тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|двести|триста|'
             'пятьсот|тысяча|две тысячи|миллион',
    'Описание': 'высокий|низкий|длинный|короткий|дорогой|дешёвый|важный|готовый|свободный|занятый|'
                'холодный|тёплый|жаркий|тёмный|ясный|полный|пустой|опасный|безопасный|'
                'странный|отличный|ужасный|прекрасный',
    'Цвета и животные': 'оранжевый|розовый|серый|коричневый|фиолетовый|медведь|волк|лиса|заяц|мышь|'
                        'корова|свинья|курица|обезьяна|слон|лев|тигр|пчела|змея|лягушка|дельфин|'
                        'пингвин|попугай|овца|коза|олень|белка',
    'Природа и погода': 'погода|солнце|свет|темнота|воздух|север|юг|запад|восток|вверх|вниз|близко|везде',
}

local = threading.local()


def compact(src: Path, dest: Path):
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', str(src), '-an', '-vf',
                    "scale='if(gt(iw,ih),480,-2)':'if(gt(iw,ih),-2,480)'", '-c:v', 'libx264',
                    '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                    str(dest)], check=True)


def fetch(r):
    cid = r['attachment_id']
    dest, poster = DEST / f'{cid}.mp4', DEST / f'{cid}.jpg'
    if not dest.exists():
        if not getattr(local, 'zip', None):
            local.zip = RemoteZip(URL, timeout=90)
        raw = DATA / 'dictionary-raw' / f'{cid}.mp4'
        raw.parent.mkdir(exist_ok=True)
        if not raw.exists():
            raw.write_bytes(local.zip.read('train/' + cid + '.mp4'))
        compact(raw, dest)
    if not poster.exists():
        cap = cv2.VideoCapture(str(dest))
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(cap.get(cv2.CAP_PROP_FRAME_COUNT) * .5))
        ok, img = cap.read()
        cap.release()
        if ok:
            cv2.imwrite(str(poster), img, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return {'id': 'word-' + cid[:8], 'label': r['text'], 'category': r['category'],
            'video': '/research/rsl/words/' + dest.name, 'poster': '/research/rsl/words/' + poster.name,
            'source': 'https://github.com/ai-forever/slovo', 'dataset': 'Slovo', 'attachmentId': cid,
            'signerId': r['user_id']}


def main():
    rows = list(csv.DictReader((DATA / 'slovo-annotations.csv').read_text().splitlines(), delimiter='\t'))
    labels = {r['text'] for r in rows}
    catalog = json.loads((DEST / 'catalog.json').read_text())
    have = {e['label'].lower() for e in catalog}
    chosen, missing = [], []
    for category, terms in GROUPS.items():
        for term in terms.split('|'):
            if term not in labels:
                missing.append(term)
                continue
            if term.lower() in have:
                continue
            have.add(term.lower())
            eligible = sorted((r for r in rows if r['text'] == term and r['train'] == 'True'),
                              key=lambda r: hashlib.sha256(r['attachment_id'].encode()).hexdigest())
            if eligible:
                chosen.append(dict(eligible[0], category=category))
    print('missing (not in Slovo, skipped):', missing, flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        added = list(pool.map(fetch, chosen))
    (DEST / 'catalog.json').write_text(json.dumps(catalog + added, ensure_ascii=False, indent=2))
    size = sum((DEST / Path(e['video']).name).stat().st_size for e in added)
    print(f'ADDED {len(added)} words, {size / 1e6:.1f} MB video; catalog now {len(catalog) + len(added)}')


if __name__ == '__main__':
    main()
