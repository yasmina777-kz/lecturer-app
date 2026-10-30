import { at } from "../i18n/automation";
export type LessonId = "getting-started" | "alphabet-intro" | "name-demo";
export const lessonIds: LessonId[] = [
  "getting-started",
  "alphabet-intro",
  "name-demo",
];
export function lessons() {
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
            "План: небольшие группы букв → просмотр образцов → различение похожих форм → своё имя. В практике уже есть пробные показы А, В, Л и пилотное распознавание этих трёх букв.",
            "Plan: small groups of letters → reference examples → distinguishing similar shapes → your name. Practice includes trial demonstrations of А, В, Л and pilot recognition for these three letters.",
            "Жоспар: шағын әріп топтары → үлгілерді қарау → ұқсас пішіндерді ажырату → өз есіміңіз. Жаттығуда А, В, Л көрсетілімдері және осы үш әріпті сынақ тану бар.",
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
