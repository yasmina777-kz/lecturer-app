import { at } from "../i18n/automation";
export const alphabet = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split("");
export function exercises() {
  const available = [
    {
      id: "a",
      level: 1,
      letter: "А",
      title: at("Буква А", "Letter А", "А әрпі"),
      model: "letter-a.glb",
      hint: at(
        "Посмотрите на кулак и положение большого пальца сбоку.",
        "Observe the fist and the thumb resting at the side.",
        "Жұдырық пен бас бармақтың бүйірдегі қалпына қараңыз.",
      ),
    },
    {
      id: "v",
      level: 1,
      letter: "В",
      title: at("Буква В", "Letter В", "В әрпі"),
      model: "letter-v.glb",
      hint: at(
        "Рассмотрите открытую ладонь и направление пальцев вверх.",
        "Observe the open palm and fingers pointing upwards.",
        "Ашық алақан мен жоғары бағытталған саусақтарға қараңыз.",
      ),
    },
    {
      id: "l",
      level: 1,
      letter: "Л",
      title: at("Буква Л", "Letter Л", "Л әрпі"),
      model: "letter-l.glb",
      hint: at(
        "Сравните направление двух вытянутых пальцев с видеообразцом.",
        "Compare the direction of the two extended fingers with the video reference.",
        "Созылған екі саусақтың бағытын бейнеүлгімен салыстырыңыз.",
      ),
    },
    {
      id: "g",
      level: 1,
      letter: "Г",
      title: at("Буква Г", "Letter Г", "Г әрпі"),
      model: "letter-g.glb",
      hint: at(
        "Указательный палец направлен вниз, большой — в сторону. Сравните силуэт с видео.",
        "Index points down, thumb points sideways. Compare the silhouette with the video.",
        "Сұқ саусақ төмен, бас бармақ бүйірге бағытталған. Бейнемен салыстырыңыз.",
      ),
    },
    {
      id: "u",
      level: 1,
      letter: "У",
      title: at("Буква У", "Letter У", "У әрпі"),
      model: "letter-u.glb",
      hint: at(
        "Мизинец направлен в сторону, большой палец раскрыт. Остальные пальцы собраны.",
        "The little finger points sideways and the thumb is extended. Other fingers are folded.",
        "Шынашақ бүйірге бағытталған, бас бармақ ашық. Қалған саусақтар бүгілген.",
      ),
    },
    {
      id: "y",
      level: 1,
      letter: "Ы",
      title: at("Буква Ы", "Letter Ы", "Ы әрпі"),
      model: "letter-y.glb",
      hint: at(
        "Указательный палец и мизинец подняты. Средний и безымянный согнуты.",
        "Index and little finger are raised; middle and ring fingers are folded.",
        "Сұқ саусақ пен шынашақ жоғары, ортаңғы және аты жоқ саусақтар бүгілген.",
      ),
    },
    {
      id: "sh",
      level: 1,
      letter: "Ш",
      title: at("Буква Ш", "Letter Ш", "Ш әрпі"),
      model: "letter-sh.glb",
      hint: at(
        "Три пальца направлены вверх и собраны рядом. Рассмотрите большой палец и мизинец.",
        "Three fingers point up together. Inspect the thumb and little finger.",
        "Үш саусақ бірге жоғары бағытталған. Бас бармақ пен шынашақты қараңыз.",
      ),
    },
    {
      id: "hello",
      level: 2,
      letter: null,
      title: at("Здравствуйте", "Hello", "Сәлеметсіз бе"),
      model: "mira-hello.glb",
      hint: at(
        "Посмотрите движение обеих рук целиком, затем повторите в медленном темпе.",
        "Watch both hands through the complete movement, then repeat slowly.",
        "Екі қолдың толық қимылын қарап, баяу қайталаңыз.",
      ),
    },
    {
      id: "thanks",
      level: 2,
      letter: null,
      title: at("Спасибо", "Thank you", "Рақмет"),
      model: "mira-thanks.glb",
      hint: at(
        "Проследите путь правой кисти у лица. Откройте ракурс ¾ и сравните начало и конец движения.",
        "Follow the right hand near the face. Use the ¾ view and compare the beginning and end.",
        "Оң қолдың бет жанындағы жолын бақылаңыз. ¾ ракурсын ашып, қимылдың басы мен соңын салыстырыңыз.",
      ),
    },
    {
      id: "name",
      level: 3,
      letter: null,
      title: at("Как тебя зовут?", "What is your name?", "Сенің атың кім?"),
      model: "mira-signing-soft.glb",
      hint: at(
        "Сначала посмотрите всю фразу. На паузе рассмотрите контакт пальцев и направление движения.",
        "Watch the whole phrase first. Pause to inspect finger contact and movement direction.",
        "Алдымен сөйлемді толық қараңыз. Кідірісте саусақтардың жанасуы мен қимыл бағытын қараңыз.",
      ),
    },
  ];
  for (const letter of alphabet) {
    if (!available.some((e) => e.letter === letter))
      available.push({
        id: "bukva-" + letter.codePointAt(0)!.toString(16),
        level: 1,
        letter,
        title: at("Буква " + letter, "Letter " + letter, letter + " әрпі"),
        model: "",
        hint: at(
          "Смотрите форму, направление и движение кисти целиком. Затем повторите перед камерой.",
          "Watch the complete hand shape, orientation and motion. Then repeat for the camera.",
          "Қол пішінін, бағыты мен қимылын толық қарап, камера алдында қайталаңыз.",
        ),
      });
  }
  return available.sort(
    (a, b) =>
      a.level - b.level ||
      (a.letter && b.letter
        ? alphabet.indexOf(a.letter) - alphabet.indexOf(b.letter)
        : 0),
  );
}

export const recognitionLetters = alphabet;
export function courseLevels() {
  return [
    {
      id: 1,
      title: at(
        "Буквы и дактиль",
        "Letters and fingerspelling",
        "Әріптер мен дактиль",
      ),
      description: at(
        "Все 33 буквы: пробные движения аватара, видео для сравнения и экспериментальная ИИ-проверка.",
        "All 33 letters: experimental avatar motion, reference videos and AI checks.",
        "33 әріптің сынақ аватар қимылдары, бейнеүлгілері және тәжірибелік ЖИ тексеруі.",
      ),
      image: "knowledge-book.png",
      count: at(
        "33 буквы · видео и ИИ",
        "33 letters · video and AI",
        "33 әріп · бейне және ЖИ",
      ),
    },
    {
      id: 2,
      title: at("Первые слова", "First words", "Алғашқы сөздер"),
      description: at(
        "Переходите от формы кисти к движению. Приветствие и благодарность.",
        "Move from hand shapes to motion. Greetings and thanks.",
        "Қол пішінінен қимылға өтіңіз. Амандасу және алғыс айту.",
      ),
      image: "mentor-dialogue-v2.png",
      count: at(
        "2 пробных показа · без ИИ-проверки",
        "2 trial demonstrations · no AI check",
        "2 сынақ көрсетілімі · ЖИ тексеруінсіз",
      ),
    },
    {
      id: 3,
      title: at(
        "Фразы и знакомство",
        "Phrases and introductions",
        "Сөйлемдер және танысу",
      ),
      description: at(
        "Посмотрите фразу «Как тебя зовут?» и разберите её по движениям.",
        "Watch “What is your name?” and inspect its movements.",
        "«Сенің атың кім?» сөйлемін қарап, қимылдарын талдаңыз.",
      ),
      image: "teacher-group-v1.png",
      count: at(
        "1 пробная фраза · без ИИ-проверки",
        "1 trial phrase · no AI check",
        "1 сынақ сөйлемі · ЖИ тексеруінсіз",
      ),
    },
  ];
}
