"""Video lessons with Kazakh teachers → frontend/public/research/ksl/teacher-lessons.json

* «Саусақтар сөйлейді» topic lessons (YouTube Sausaqtarsoileidi, Aktobe): each word
  segment starts at its word card (ml/ksl/sausaq-card-runs.json) and ends where the
  next card starts.
* «Оян, Qazaqstan» (Седьмой канал): everyday phrases shown by a sign-language
  interpreter and then by deaf passers-by — several different signers per phrase.
Videos are embedded with the official YouTube player (start/end), never copied.
  python3 ml/ksl/build_teacher_lessons.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1].parent
RUNS = json.loads((ROOT / 'ml/ksl/sausaq-card-runs.json').read_text())

# video, kk title, ru title, card labels in order (kk | ru); '' = skip (title card etc.)
TOPICS = [
    ('h6ukdwq-D6o', 'Амандасу, танысу', 'Приветствие и знакомство',
     ['Сәлеметсіздер ме?|Здравствуйте!', 'Сау болыңыз|До свидания', 'Рахмет|Спасибо', 'Кешіріңіз|Извините',
      'Аты|Имя', 'Тегі|Фамилия', 'Әкесінің аты|Отчество', 'Әкесінің аты|Отчество']),
    ('23QnvVYEBnE', 'Сұрақтар: Кім? Не? Қайда?', 'Вопросы: кто? что? где?',
     ['Кім?|Кто?', 'Не?|Что?', 'Қайда?|Где?', 'Қашан?|Когда?', 'Неге?|Почему?']),
    ('5Sx7aFrNi4k', 'Отбасы', 'Семья',
     ['Отбасы|Семья', 'Әке|Папа', 'Ана|Мама', 'Ата|Дедушка', 'Әже|Бабушка', 'Ер бала (ұл)|Сын',
      'Қыз бала (қыз)|Дочь', 'Аға|Старший брат', 'Әпке|Старшая сестра', 'Ұл, қыз|Сын и дочь']),
    ('hooL1fiLhuQ', 'Білім', 'Образование',
     ['Білім|Образование', 'Балабақша|Детский сад', 'Мектеп|Школа', 'Колледж|Колледж', 'Университет|Университет']),
    ('_rL51pEYS0s', 'Спорт', 'Спорт',
     ['Спорт|Спорт', 'Күрес|Борьба', 'Футбол|Футбол', 'Шахмат|Шахматы', 'Велоспорт|Велоспорт']),
    ('dEAouzZnW6w', 'Мәдениет', 'Культура',
     ['Мәдениет|Культура', 'Кітапхана|Библиотека', 'Кітапхана|Библиотека', 'Қалалық мәдениет үйі|Городской дом культуры', 'Өнер орталығы|Центр искусств']),
    ('xCPLp2Sy0F4', 'Сандар 1–9', 'Числа 1–9',
     ['Сандар|Числа'] + [f'{k}|{v}' for k, v in zip('Бір Екі Үш Төрт Бес Алты Жеті Сегіз Тоғыз'.split(), range(1, 10))]),
    ('xtzQEz8a3i8', 'Сандар 10–19', 'Числа 10–19',
     [f'{k}|{v}' for k, v in zip(['Он', 'Он бір', 'Он екі', 'Он үш', 'Он төрт', 'Он бес', 'Он алты', 'Он жеті', 'Он сегіз', 'Он тоғыз'], range(10, 20))]),
    ('T_XJeRPc6Sk', 'Сандар 20–90', 'Числа 20–90',
     [f'{k}|{v}' for k, v in zip('Жиырма Отыз Қырық Елу Алпыс Жетпіс Сексен Тоқсан'.split(), range(20, 100, 10))]),
    ('xQo0pd9iIRQ', 'Сандар 100–1000', 'Числа 100–1000',
     [f'{k}|{v}' for k, v in zip(['Жүз', 'Екі жүз', 'Үш жүз', 'Төрт жүз', 'Бес жүз', 'Алты жүз', 'Жеті жүз', 'Сегіз жүз', 'Тоғыз жүз', 'Мың'], range(100, 1001, 100))]),
]
EXTRA = [  # math lessons: whole video, no word cards
    ('0bMYCOkHuFs', 'Математика: қосу', 'Математика: сложение'),
    ('RUyw-_T4vm0', 'Математика: алу', 'Математика: вычитание'),
    ('IVungvoKP7I', 'Математика: көбейту', 'Математика: умножение'),
    ('1MbmVJ6gz1E', 'Математика: бөлу', 'Математика: деление'),
]
PHRASES = [  # video, start, end, kk, ru (timestamps checked on contact sheets)
    ('kaJbkN1y3zc', 18, 36, 'Сәлеметсіз бе!', 'Здравствуйте!'),
    ('kaJbkN1y3zc', 36, 48, 'Халіңіз қалай?', 'Как ваши дела?'),
    ('kaJbkN1y3zc', 48, 60, 'Керемет!', 'Отлично!'),
    ('kaJbkN1y3zc', 60, 82, 'Қайырлы таң!', 'Доброе утро!'),
    ('kaJbkN1y3zc', 82, 100, 'Қайырлы күн!', 'Добрый день!'),
    ('kaJbkN1y3zc', 100, 112, 'Қайырлы кеш!', 'Добрый вечер!'),
    ('kaJbkN1y3zc', 112, 122, 'Қайырлы түн!', 'Спокойной ночи!'),
    ('2c-3DcTmdgM', 9, 22, 'Кешірім сұраймын', 'Прошу прощения'),
    ('2c-3DcTmdgM', 22, 40, 'Жол көрсетіңізші', 'Подскажите дорогу, пожалуйста'),
    ('2c-3DcTmdgM', 40, 58, 'Маған көмектесе аласыз ба?', 'Вы можете мне помочь?'),
    ('cn3aZc9lvmI', 12, 34, 'Күніңіз сәтті өтсін!', 'Удачного вам дня!'),
    ('cn3aZc9lvmI', 34, 56, 'Мен сізді жақсы көремін', 'Я вас люблю'),
    ('cn3aZc9lvmI', 56, 66, 'Рахмет!', 'Спасибо!'),
    ('cn3aZc9lvmI', 66, 106, 'Әр таң — өзгеруге мүмкіндік', 'Каждое утро — возможность измениться'),
]


def main():
    lessons = []
    for vid, kk, ru, labels in TOPICS:
        r = RUNS[vid]; fps = r['fps']; runs = r['runs']
        assert len(labels) == len(runs), (vid, len(labels), len(runs))
        words = []
        for k, lab in enumerate(labels):
            if not lab:
                continue
            wk, wr = lab.split('|')
            a = runs[k][0] / fps
            b = runs[k + 1][0] / fps if k + 1 < len(runs) else r['n'] / fps
            if words and words[-1]['kk'] == wk:  # same word on two cards
                words[-1]['end'] = round(b, 1)
                continue
            words.append(dict(kk=wk, ru=wr, start=round(max(a - .3, 0), 1), end=round(b, 1)))
        lessons.append(dict(youtube=vid, kk=kk, ru=ru, words=words))
    for vid, kk, ru in EXTRA:
        lessons.append(dict(youtube=vid, kk=kk, ru=ru, words=[]))
    phrases = [dict(youtube=v, start=a, end=b, kk=kk, ru=ru) for v, a, b, kk, ru in PHRASES]
    out = dict(
        source='YouTube: «Саусақтар сөйлейді» (Sausaqtarsoileidi, Ақтөбе) and «Оян, Qazaqstan» (Седьмой канал)',
        note='Embedded with the official YouTube player; videos are not copied.',
        teacher=dict(channel='https://www.youtube.com/@Sausaqtarsoileidi', lessons=lessons),
        phrases=dict(channel='https://www.youtube.com/channel/UC0q2YQodHMDf2MBtVq4SFSQ', items=phrases),
    )
    p = ROOT / 'frontend/public/research/ksl/teacher-lessons.json'
    p.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(len(lessons), 'lessons', sum(len(l['words']) for l in lessons), 'words', len(phrases), 'phrases')


if __name__ == '__main__':
    main()
