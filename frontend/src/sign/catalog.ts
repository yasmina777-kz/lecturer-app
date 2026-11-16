import { at } from "../i18n/automation";
export type LessonId =
  | "getting-started"
  | "alphabet-intro"
  | "dictionary-words"
  | "watch-sign"
  | "context-in-video"
  | "dialogue-practice"
  | "name-demo";
export type Lesson = {
  id: LessonId;
  level: number;
  kind: "reading" | "prototype";
  title: string;
  description: string;
  minutes: number;
  image?: string;
  activity?: string;
};
export const lessonIds: LessonId[] = [
  "getting-started",
  "alphabet-intro",
  "dictionary-words",
  "watch-sign",
  "context-in-video",
  "dialogue-practice",
  "name-demo",
];
export function lessons(): Lesson[] {
  return [
    {
      id: "getting-started" as LessonId,
      level: 1,
      kind: "reading",
      title: at(
        "Как учиться с аватаром",
        "Learning with the avatar",
        "Аватармен қалай үйренуге болады",
      ),
      description: at(
        "Знакомство с просмотром, ракурсами и самостоятельным повторением.",
        "An introduction to viewing, camera angles and independent practice.",
        "Көру, ракурстар және өз бетімен қайталаумен танысу.",
      ),
      minutes: 3,
    },
    {
      id: "alphabet-intro" as LessonId,
      level: 1,
      kind: "reading",
      title: at(
        "Буквы, имена и дактиль",
        "Letters, names and fingerspelling",
        "Әріптер, есімдер және дактиль",
      ),
      description: at(
        "Для чего нужна ручная азбука и чем она отличается от жестов слов.",
        "What fingerspelling is for and how it differs from word signs.",
        "Қол әліпбиі не үшін қажет және сөз ымдарынан несімен ерекшеленеді.",
      ),
      minutes: 3,
    },
    {
      id: "dictionary-words" as LessonId,
      level: 2,
      kind: "reading",
      title: at(
        "Первые слова: учимся по словарю",
        "First words: learning with the dictionary",
        "Алғашқы сөздер: сөздікпен үйрену",
      ),
      description: at(
        "Изучайте жесты по темам, смотрите видео людей и повторяйте слова с проверкой понимания.",
        "Study signs by topic, watch human references and review vocabulary with comprehension practice.",
        "Ымдарды тақырып бойынша қарап, бейнені көріп, сөздерді түсіну жаттығуымен қайталаңыз.",
      ),
      minutes: 8,
      image: "/illustrations/sign-phrases/phrase-02.jpg",
      activity: "/text-to-sign?tab=dictionary",
    },
    {
      id: "watch-sign" as LessonId,
      level: 2,
      kind: "reading",
      title: at(
        "Как внимательно смотреть жест",
        "How to observe a sign",
        "Ымды қалай мұқият бақылауға болады",
      ),
      description: at(
        "Разбирайте не только пальцы: замечайте форму, ориентацию, место, движение и выражение лица.",
        "Look beyond the fingers: notice handshape, orientation, location, movement and facial expression.",
        "Тек саусақтарды емес, қол пішінін, бағытын, орнын, қимылын және бет әлпетін байқаңыз.",
      ),
      minutes: 6,
      image: "/illustrations/sign-phrases/phrase-03.jpg",
      activity: "/text-to-sign?tab=dictionary",
    },
    {
      id: "context-in-video" as LessonId,
      level: 3,
      kind: "reading",
      title: at(
        "Понимаем значение в контексте",
        "Understand signs in context",
        "Контекст арқылы түсіну",
      ),
      description: at(
        "Сначала смотрите весь фрагмент, затем выбирайте смысл. Словарное видео показывает пример, но не заменяет перевод разговора.",
        "Watch the full clip before choosing a meaning. A dictionary video is an example, not a translation of a conversation.",
        "Мағынаны таңдаудан бұрын бейнені толық көріңіз. Сөздік видеосы — мысал, әңгіме аудармасы емес.",
      ),
      minutes: 7,
      image: "/illustrations/sign-phrases/phrase-04.jpg",
      activity: "/understanding",
    },
    {
      id: "dialogue-practice" as LessonId,
      level: 3,
      kind: "reading",
      title: at(
        "Практикуем общение",
        "Practise communication",
        "Қарым-қатынас жаттығуы",
      ),
      description: at(
        "Потренируйтесь в знакомстве, на занятии и в магазине. Диалоги помогают понять ситуацию, но их жестовую грамматику ещё нужно проверять с преподавателем.",
        "Practise meeting, class and shopping scenarios. These dialogues build situational understanding; their signed grammar still needs teacher review.",
        "Танысу, сабақ және дүкен жағдайларын жаттықтырыңыз. Диалогтар жағдайды түсінуге көмектеседі, бірақ ым грамматикасын мұғалім тексеруі керек.",
      ),
      minutes: 8,
      image: "/illustrations/sign-phrases/phrase-05.jpg",
      activity: "/dialogues",
    },
    {
      id: "name-demo" as LessonId,
      level: 3,
      kind: "prototype",
      title: at("Как тебя зовут?", "What is your name?", "Сенің атың кім?"),
      description: at(
        "Пробная анимация: ракурсы, пауза, замедление и разбор движения.",
        "Prototype animation: angles, pause, slow motion and movement breakdown.",
        "Сынақ анимациясы: ракурстар, кідіріс, баяулату және қимылды талдау.",
      ),
      minutes: 5,
      image: "/illustrations/sign-phrases/phrase-01.jpg",
    },
  ];
}
export function reading(id: LessonId) {
  if (id === "alphabet-intro")
    return {
      blocks: [
        [
          at(
            "Что такое дактиль",
            "What is fingerspelling?",
            "Дактиль деген не?",
          ),
          at(
            "Дактильная азбука передаёт буквы положениями и движениями кисти. Её используют, например, для имён и названий. Это часть обучения, а не замена всему жестовому языку.",
            "Fingerspelling represents letters using hand positions and movements. It is used, for example, for names. It is part of learning, not a replacement for an entire sign language.",
            "Дактиль әліпбиі әріптерді қол қалпы мен қимылы арқылы береді. Ол, мысалы, есімдер мен атаулар үшін қолданылады. Бұл — оқудың бір бөлігі, бүкіл ым тілінің орнына жүрмейді.",
          ),
        ],
        [
          at(
            "Буква и жест слова",
            "A letter and a word sign",
            "Әріп пен сөздің ымы",
          ),
          at(
            "Показать слово по буквам и передать его жестом — разные способы. У РЖЯ есть собственная лексика и грамматика. Перевод фразы нельзя свести к показу её букв по порядку.",
            "Spelling a word and using its sign are different approaches. RSL has its own vocabulary and grammar. Translating a phrase is not the same as spelling its letters in order.",
            "Сөзді әріптермен және ыммен көрсету — әртүрлі тәсілдер. Орыс ым тілінің өз сөздігі мен грамматикасы бар. Сөйлемді аудару әріптерді ретімен көрсетуге тең емес.",
          ),
        ],
        [
          at(
            "Как будем изучать буквы",
            "How we will study letters",
            "Әріптерді қалай үйренеміз",
          ),
          at(
            "План: небольшие группы букв → просмотр образцов → различение похожих форм → своё имя. В практике есть видео и пробные 3D-показы всех 33 букв и экспериментальная ИИ-проверка алфавита.",
            "Plan: small groups of letters → reference examples → distinguishing similar shapes → your name. Practice includes videos and trial 3D demonstrations for all 33 letters and experimental alphabet recognition.",
            "Жоспар: шағын әріп топтары → үлгілерді қарау → ұқсас пішіндерді ажырату → өз есіміңіз. Жаттығуда 33 әріптің бейнесі мен сынақ 3D көрсетілімдері және әліпбиді тәжірибелік ЖИ тексеруі бар.",
          ),
        ],
      ],
      question: at(
        "Что означает показать имя дактилем?",
        "What does fingerspelling a name mean?",
        "Есімді дактильмен көрсету нені білдіреді?",
      ),
      options: [
        at(
          "Передать буквы имени",
          "Represent the letters of the name",
          "Есімнің әріптерін беру",
        ),
        at(
          "Перевести любой текст без учёта грамматики",
          "Translate any text without considering grammar",
          "Кез келген мәтінді грамматикасыз аудару",
        ),
      ],
      correct: 0,
      explanation: at(
        "Верно: дактиль передаёт буквы. Он не заменяет грамматику и лексику РЖЯ.",
        "Correct: fingerspelling represents letters. It does not replace RSL grammar and vocabulary.",
        "Дұрыс: дактиль әріптерді береді. Ол орыс ым тілінің грамматикасы мен сөздігін алмастырмайды.",
      ),
    };
  if (id === "dictionary-words")
    return {
      blocks: [
        [
          at("Один знак за раз", "One sign at a time", "Бір ымнан бастаңыз"),
          at(
            "РЖЯ — отдельный язык, а не набор русских слов, показанных руками. Начните с видео одного жеста и его значения. В словаре AI Mentor собраны учебные примеры из Slovo; они помогают знакомиться со словами, но сами по себе не составляют проверенный курс.",
            "RSL is a language in its own right, not Russian words shown with the hands. Start with one sign video and its meaning. AI Mentor's dictionary contains learning examples from Slovo; they introduce vocabulary but are not, by themselves, a reviewed course.",
            "Орыс ым тілі — қолмен көрсетілген орыс сөздерінің жиынтығы емес, жеке тіл. Бір ымның бейнесі мен мағынасынан бастаңыз. AI Mentor сөздігінде Slovo оқу мысалдары бар; олар сөздікпен таныстырады, бірақ толық тексерілген курс емес.",
          ),
        ],
        [
          at(
            "Работайте по темам",
            "Study by topic",
            "Тақырып бойынша үйреніңіз",
          ),
          at(
            "Выберите небольшую группу — например, приветствия, время или семью. Посмотрите видео целиком, назовите значение, затем повторите и вернитесь к нему позже. Если жест в словаре показывает аватар, сверяйтесь с видео человека: анимация экспериментальная.",
            "Choose a small group, such as greetings, time or family. Watch each clip, recall the meaning, practise it and review it later. When the avatar demonstrates a sign, compare it with the human video; the animation is experimental.",
            "Амандасу, уақыт немесе отбасы сияқты шағын топты таңдаңыз. Бейнені толық көріп, мағынасын айтып, қайталап, кейін қайта оралыңыз. Аватар көрсетсе, адамның видеосымен салыстырыңыз: анимация тәжірибелік.",
          ),
        ],
        [
          at(
            "Буквы — отдельный навык",
            "Fingerspelling is a separate skill",
            "Дактиль — бөлек дағды",
          ),
          at(
            "Дактиль передаёт написание имён и незнакомых слов по буквам. Для обычной лексики сначала ищите самостоятельный жест слова; не заменяйте весь словарь побуквенным показом.",
            "Fingerspelling spells names and unfamiliar words letter by letter. For everyday vocabulary, first look for the sign used for the word; do not replace the whole vocabulary with spelling.",
            "Дактиль есімдер мен таныс емес сөздерді әріппен көрсетеді. Күнделікті сөздер үшін алдымен сөздің өз ымын іздеңіз; бүкіл сөздікті әріппен көрсетумен алмастырмаңыз.",
          ),
        ],
      ],
      question: at(
        "Что лучше сделать после просмотра слова?",
        "What should you do after watching a word sign?",
        "Сөз ымын көргеннен кейін не істеген дұрыс?",
      ),
      options: [
        at(
          "Повторить значение и жест, затем вернуться к нему позже",
          "Recall the meaning, practise the sign, then review it later",
          "Мағынасын еске түсіріп, ымды қайталап, кейін қайта қарау",
        ),
        at(
          "Считать, что теперь можно переводить любые предложения",
          "Assume you can now translate any sentence",
          "Енді кез келген сөйлемді аудара аламын деп ойлау",
        ),
      ],
      correct: 0,
      explanation: at(
        "Верно. Словарный жест помогает выучить слово, но не обучает грамматике и переводу фраз.",
        "Correct. A dictionary sign teaches a word, not sentence grammar or translation.",
        "Дұрыс. Сөздік ымы сөзді үйретеді, бірақ сөйлем грамматикасын не аудармасын емес.",
      ),
    };
  if (id === "watch-sign")
    return {
      blocks: [
        [
          at(
            "Посмотрите весь фрагмент",
            "Watch the whole clip",
            "Бейнені толық көріңіз",
          ),
          at(
            "Не останавливайтесь на первом кадре. Посмотрите начало, движение и завершение: движение кисти может быть частью значения.",
            "Do not stop at the first frame. Watch the start, movement and finish; the hand's motion can carry meaning.",
            "Алғашқы кадрмен шектелмеңіз. Басы, қимылы және аяқталуын көріңіз: қол қозғалысы мағынаның бір бөлігі болуы мүмкін.",
          ),
        ],
        [
          at(
            "Заметьте форму и направление",
            "Notice shape and orientation",
            "Пішін мен бағытты байқаңыз",
          ),
          at(
            "Сравните положение пальцев и ладони, направление кисти и место выполнения жеста. В словарном примере эти детали помогают отличать движения; аватар может упрощать их.",
            "Compare finger and palm shape, hand orientation and signing location. These details help distinguish signs; the avatar may simplify them.",
            "Саусақ пен алақанның қалпын, қол бағытын және ым жасалатын орынды салыстырыңыз. Бұл белгілер ымдарды ажыратуға көмектеседі; аватар кейбірін жеңілдетуі мүмкін.",
          ),
        ],
        [
          at(
            "Смотрите на лицо и тело",
            "Watch face and body",
            "Бет пен денеге назар аударыңыз",
          ),
          at(
            "Выражение лица, взгляд и положение тела могут участвовать в сообщении. Не оценивайте жест только по кистям; для грамматических значений сверяйтесь с полным видео и преподавателем РЖЯ.",
            "Facial expression, gaze and body posture can contribute to the message. Do not judge a sign by the hands alone; consult full video and an RSL teacher for grammatical meaning.",
            "Бет әлпеті, көзқарас және дене қалпы хабарға әсер етуі мүмкін. Ымды тек қолмен бағаламаңыз; грамматикалық мағына үшін толық бейне мен РЖЯ мұғаліміне сүйеніңіз.",
          ),
        ],
      ],
      question: at(
        "Что нужно наблюдать в видео жеста?",
        "What should you observe in a sign video?",
        "Ым бейнесінен нені бақылау керек?",
      ),
      options: [
        at(
          "Только положение пальцев",
          "Only finger positions",
          "Тек саусақтардың қалпы",
        ),
        at(
          "Форму, движение, место, направление и лицо",
          "Shape, movement, location, orientation and face",
          "Пішін, қимыл, орын, бағыт және бет әлпеті",
        ),
      ],
      correct: 1,
      explanation: at(
        "Верно. РЖЯ передаётся не только пальцами; сравнивайте весь фрагмент.",
        "Correct. RSL is not conveyed by fingers alone; observe the whole clip.",
        "Дұрыс. Орыс ым тілі тек саусақпен берілмейді; бейнені толық бақылаңыз.",
      ),
    };
  if (id === "context-in-video")
    return {
      blocks: [
        [
          at(
            "Сначала поймите ситуацию",
            "Start with the situation",
            "Алдымен жағдайды түсініңіз",
          ),
          at(
            "Посмотрите весь ролик и определите, кто общается и о чём. Затем выберите значение жеста. Контекст помогает учиться понимать речь, но не заменяет разметку или знание языка.",
            "Watch the whole clip and notice who is communicating and about what. Then choose the sign's meaning. Context supports comprehension practice, but it does not replace annotation or language knowledge.",
            "Бейнені толық көріп, кім сөйлесіп жатқанын және не туралы екенін байқаңыз. Содан кейін ым мағынасын таңдаңыз. Контекст түсінуге көмектеседі, бірақ тіл білімін алмастырмайды.",
          ),
        ],
        [
          at(
            "Словарный пример — это пример",
            "A dictionary clip is an example",
            "Сөздік бейне — мысал",
          ),
          at(
            "Видеословарь показывает отдельный жест в конкретной записи. Он не всегда раскрывает варианты, грамматическую форму и употребление в предложении. Сравнивайте несколько примеров, когда они доступны.",
            "A dictionary shows one sign in one recording. It may not cover variants, grammatical forms or use in a sentence. Compare several examples when available.",
            "Сөздік белгілі бір жазбадағы жеке ымды көрсетеді. Ол барлық нұсқаны, грамматикалық форманы және сөйлемдегі қолданысты қамтымауы мүмкін. Қолжетімді болса, бірнеше мысалды салыстырыңыз.",
          ),
        ],
        [
          at(
            "Исправляйте себя спокойно",
            "Review without guessing",
            "Асықпай тексеріңіз",
          ),
          at(
            "Если ответ не совпал, пересмотрите фрагмент и обратите внимание на лицо, движение и ситуацию. Текущая ИИ-модель не является переводчиком фраз; проверка значения в упражнениях не оценивает вашу грамматику РЖЯ.",
            "If your answer differs, replay the clip and notice the face, movement and situation. The current AI model is not a sentence translator; a meaning quiz does not assess your RSL grammar.",
            "Жауап сәйкес болмаса, бейнені қайта қарап, бет әлпетін, қимылды және жағдайды байқаңыз. Қазіргі ЖИ фраза аудармашысы емес; мағына жаттығуы РЖЯ грамматикасын бағаламайды.",
          ),
        ],
      ],
      question: at(
        "Что делать, если значение неясно?",
        "What should you do when the meaning is unclear?",
        "Мағына түсініксіз болса не істеген дұрыс?",
      ),
      options: [
        at(
          "Пересмотреть целый фрагмент и учесть ситуацию",
          "Replay the full clip and consider the situation",
          "Бейнені толық қайта қарап, жағдайды ескеру",
        ),
        at(
          "Считать первое предположение точным переводом",
          "Treat the first guess as a precise translation",
          "Алғашқы болжамды нақты аударма деп санау",
        ),
      ],
      correct: 0,
      explanation: at(
        "Верно. Контекст и полный фрагмент помогают учиться понимать, но не превращают упражнение в переводчик.",
        "Correct. Context and the full clip support comprehension, but the exercise is not a translator.",
        "Дұрыс. Контекст пен толық бейне түсінуге көмектеседі, бірақ жаттығу аудармашы емес.",
      ),
    };
  if (id === "dialogue-practice")
    return {
      blocks: [
        [
          at(
            "Разыграйте ситуацию",
            "Practise a situation",
            "Жағдайды жаттықтырыңыз",
          ),
          at(
            "В диалоге важно понять, чего хочет собеседник: познакомиться, попросить помощи или ответить на вопрос. Выберите одну из ситуаций и пройдите её до конца.",
            "In a dialogue, understand what the other person needs: to meet, ask for help or answer a question. Choose a scenario and complete it.",
            "Диалогта адамның не қалайтынын түсініңіз: танысу, көмек сұрау немесе сұраққа жауап беру. Бір жағдайды таңдап, соңына дейін өтіңіз.",
          ),
        ],
        [
          at(
            "Используйте словарь как опору",
            "Use the dictionary as a reference",
            "Сөздікті тірек ретінде қолданыңыз",
          ),
          at(
            "Если встречается незнакомое слово, откройте видеословарь и посмотрите пример. Показ аватара и последовательность слов в приложении пока не являются грамматически проверенным переводом.",
            "If a word is unfamiliar, look it up in the video dictionary. The avatar and word sequences in the app are not yet a grammatically reviewed translation.",
            "Таныс емес сөз болса, оны бейне сөздіктен қараңыз. Қосымшадағы аватар мен сөздер тізбегі грамматикасы тексерілген аударма емес.",
          ),
        ],
        [
          at(
            "Учитесь уточнять",
            "Ask for clarification",
            "Нақтылауды үйреніңіз",
          ),
          at(
            "Если не поняли жест, попросите повторить или показать медленнее. Это полезная стратегия общения; не нужно притворяться, что вы всё поняли.",
            "If you do not understand a sign, ask the person to repeat or slow it down. Clarifying is a useful communication strategy.",
            "Ымды түсінбесеңіз, қайталап не баяуырақ көрсетуді сұраңыз. Нақтылау — пайдалы қарым-қатынас тәсілі.",
          ),
        ],
      ],
      question: at(
        "Как поступить, если вы не поняли жест?",
        "What should you do if you did not understand a sign?",
        "Ымды түсінбесеңіз не істейсіз?",
      ),
      options: [
        at(
          "Попросить повторить или уточнить",
          "Ask for a repeat or clarification",
          "Қайталауды не нақтылауды сұрау",
        ),
        at(
          "Сразу угадать и продолжить",
          "Guess and move on",
          "Болжап, жалғастыру",
        ),
      ],
      correct: 0,
      explanation: at(
        "Верно. Уточнение помогает продолжить общение без догадок.",
        "Correct. Clarifying helps the conversation continue without guessing.",
        "Дұрыс. Нақтылау болжамсыз сөйлесуді жалғастыруға көмектеседі.",
      ),
    };
  return {
    blocks: [
      [
        at("Сначала наблюдайте", "Observe first", "Алдымен бақылаңыз"),
        at(
          "Откройте образец и посмотрите движение целиком. В 3D-пробе можно повернуть аватара и приблизить кисти. Стороны в подсказках обозначены со стороны аватара.",
          "Watch the full demonstration first. In the 3D prototype, you can rotate the avatar and zoom in on its hands. Left and right in the tips refer to the avatar.",
          "Алдымен қимылды толық қараңыз. 3D сынағында аватарды бұрып, қолдарын үлкейтуге болады. Кеңестердегі оң және сол жақ аватарға қатысты.",
        ),
      ],
      [
        at("Затем разберите", "Then inspect", "Содан кейін талдаңыз"),
        at(
          "На паузе рассмотрите форму кистей, направление и место движения. Замедлите анимацию. Обращайте внимание и на лицо: наблюдение только за пальцами не показывает всей картины.",
          "Pause to inspect hand shapes, direction and location. Slow the animation down. Pay attention to the face too: fingers alone do not show the whole picture.",
          "Кідірісте қол пішінін, қимыл бағыты мен орнын қараңыз. Анимацияны баяулатыңыз. Бетке де назар аударыңыз: тек саусақтар толық көрініс бермейді.",
        ),
      ],
      [
        at(
          "Повторяйте по образцу",
          "Practise with a reference",
          "Үлгімен қайталаңыз",
        ),
        at(
          "Сверяйтесь с видео человека, указанным в пробном уроке. Анимация пока требует экспертной проверки. Отметка «Я повторил(а)» фиксирует ваше занятие, но не подтверждает правильность жеста.",
          "Use the human reference video linked in the trial lesson. The animation still needs expert review. An “I practised” mark records your session, not signing accuracy.",
          "Сынақ сабақтағы адамның бейнеүлгісіне сүйеніңіз. Анимацияны маман әлі тексеруі керек. «Қайталадым» белгісі жаттығуды тіркейді, ымның дұрыстығын растамайды.",
        ),
      ],
    ],
    question: at(
      "Что делать, если движение слишком быстрое?",
      "What if the movement is too fast?",
      "Қимыл тым жылдам болса не істеу керек?",
    ),
    options: [
      at(
        "Увеличить скорость и пропустить детали",
        "Speed up and skip the details",
        "Жылдамдатып, бөлшектерді өткізу",
      ),
      at(
        "Замедлить, поставить паузу и сменить ракурс",
        "Slow down, pause and change the angle",
        "Баяулату, кідірту және ракурсты өзгерту",
      ),
    ],
    correct: 1,
    explanation: at(
      "Верно. Пауза, скорость и ракурс помогают рассмотреть движение.",
      "Correct. Pause, speed and camera controls help you inspect movement.",
      "Дұрыс. Кідіріс, қарқын және ракурс қимылды көруге көмектеседі.",
    ),
  };
}
