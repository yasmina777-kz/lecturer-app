import { at } from "../i18n/automation";
import type { PhraseItem } from "./course";

/** Step-by-step A1 course: each unit = new signs → recognise them → phrases →
 * sign it yourself (camera) → grammar + dialogue → review. Signs are dictionary
 * labels (native-signer videos); phrases follow RSL word order. */
export type CourseUnit = {
  id: number;
  title: string;
  goal: string;
  words: string[];
  phrases: PhraseItem[];
  grammar?: string;
  dialogue?: string;
  extra?: { to: string; label: string };
  tip: string;
};

export function courseUnits(): CourseUnit[] {
  return [
    {
      id: 1, title: at("Знакомство", "Meeting", "Танысу"),
      goal: at("Поздороваться, спросить имя, сказать «не понимаю».", "Greet, ask a name, say “I don't understand”.", "Сәлемдесу, атын сұрау."),
      words: ["Привет!", "я", "ты", "имя", "кто?", "знать", "понять", "друг"],
      phrases: [
        { ru: "Как тебя зовут?", signs: ["ты", "имя", "кто?"], tip: "Вопросительное слово — в конце, брови сведены." },
        { ru: "Я не понимаю", signs: ["я", "не", "понять"] },
        { ru: "Это мой друг", signs: ["это", "мой", "друг"] },
      ],
      grammar: "questions", dialogue: "meeting",
      extra: { to: "/fingerspell", label: at("Своё имя — дактилем: «Чтение дактиля»", "Your name in fingerspelling", "Атыңыз дактильмен") },
      tip: at("Имя показывают по буквам. Позже глухие могут дать вам жестовое имя.", "Names are fingerspelled; later the Deaf community may give you a name sign.", "Есімді әріптермен көрсетеді."),
    },
    {
      id: 2, title: at("Семья", "Family", "Отбасы"),
      goal: at("Рассказать, кто есть в семье.", "Talk about your family.", "Отбасыңыз туралы айту."),
      words: ["семья", "мать", "отец", "брат", "сестра", "ребёнок", "большой", "маленький"],
      phrases: [
        { ru: "Моя семья большая", signs: ["мой", "семья", "большой"], tip: "Признак — после предмета." },
        { ru: "Это моя мама", signs: ["это", "мой", "мать"] },
        { ru: "У меня есть брат и сестра", signs: ["я", "брат", "сестра"], tip: "«Есть / иметь» часто не показывают отдельно." },
      ],
      grammar: "adjectives", dialogue: "family",
      tip: at("Членов семьи часто «расставляют» в пространстве и потом указывают на них.", "Family members are often placed in space and pointed to.", "Отбасы мүшелерін кеңістікке орналастырады."),
    },
    {
      id: 3, title: at("Числа 1–10", "Numbers 1–10", "Сандар 1–10"),
      goal: at("Показать и узнать числа до десяти.", "Sign and recognise numbers to ten.", "Онға дейінгі сандар."),
      words: ["один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять"],
      phrases: [
        { ru: "Три книги", signs: ["книга", "три"], tip: "Число — после предмета." },
        { ru: "Мне двадцать лет", signs: ["я", "год", "двадцать"] },
      ],
      grammar: "plural",
      extra: { to: "/numbers", label: at("Тренажёр «Числа, время, деньги»", "Numbers, time, money trainer", "Сандар, уақыт, ақша") },
      tip: at("Числа в РЖЯ показывают одной рукой; у разных людей формы могут немного отличаться.", "Numbers are one-handed; forms vary a little between signers.", "Сандар бір қолмен көрсетіледі."),
    },
    {
      id: 4, title: at("Время и дни", "Time and days", "Уақыт пен күндер"),
      goal: at("Сказать, когда что-то было или будет.", "Say when something happened or will happen.", "Қашан екенін айту."),
      words: ["сегодня", "завтра", "вчера", "утро", "вечер", "день", "неделя", "когда"],
      phrases: [
        { ru: "Завтра я работаю", signs: ["завтра", "я", "работать"], tip: "Время — в начале фразы, глагол не меняется." },
        { ru: "Вчера я читал книгу", signs: ["вчера", "я", "книга", "читать"] },
        { ru: "Когда ты спишь?", signs: ["ты", "спать", "когда"] },
      ],
      grammar: "time", dialogue: "plans",
      tip: at("Прошлое и будущее передают словом времени в начале, а не формой глагола.", "Past and future are marked by a time word first.", "Уақыт сөзі басында."),
    },
    {
      id: 5, title: at("Деньги и покупки", "Money and shopping", "Ақша және сауда"),
      goal: at("Спросить цену и купить.", "Ask the price and buy.", "Бағасын сұрап, сатып алу."),
      words: ["деньги", "цена", "сколько", "Рубль", "купить", "хлеб", "дорогой", "дешёвый"],
      phrases: [
        { ru: "Сколько стоит?", signs: ["цена", "сколько"] },
        { ru: "Я купил хлеб", signs: ["я", "хлеб", "купить"] },
        { ru: "Это дорого", signs: ["это", "дорогой"] },
      ],
      grammar: "order", dialogue: "shop",
      extra: { to: "/numbers", label: at("Потренируйте цены в «Числа, время, деньги»", "Practise prices", "Бағаларды жаттықтыру") },
      tip: at("«Сколько» — в конце вопроса, с вопросительным лицом.", "“How much” comes last, with a questioning face.", "«Қанша» соңында."),
    },
    {
      id: 6, title: at("Мой день", "My day", "Менің күнім"),
      goal: at("Рассказать о делах и где вы живёте.", "Talk about your day and where you live.", "Күніңіз туралы айту."),
      words: ["работать", "спать", "есть", "пить", "дом", "школа", "идти", "жить"],
      phrases: [
        { ru: "Я живу в городе", signs: ["я", "город", "жить"] },
        { ru: "Мы идём домой", signs: ["мы", "дом", "идти"] },
        { ru: "Я работаю в школе", signs: ["я", "школа", "работать"] },
      ],
      grammar: "order", dialogue: "study",
      tip: at("Место обычно называют до действия: Я ГОРОД ЖИТЬ.", "Place usually comes before the action.", "Орын әрекеттен бұрын."),
    },
    {
      id: 7, title: at("Кафе и еда", "Café and food", "Кафе және тамақ"),
      goal: at("Заказать еду и напиток, сказать «вкусно».", "Order food and a drink.", "Тамақ тапсыру."),
      words: ["кафе", "вода", "пить", "есть", "хотеть", "вкусный", "холодный", "хлеб"],
      phrases: [
        { ru: "Я хочу пить", signs: ["я", "пить", "хотеть"] },
        { ru: "Я не хочу есть", signs: ["я", "есть", "не", "хотеть"], tip: "Отрицание НЕ — перед глаголом, плюс покачивание головой." },
        { ru: "Вкусно!", signs: ["вкусный"] },
      ],
      grammar: "negation", dialogue: "cafe",
      tip: at("ХОТЕТЬ часто стоит в конце фразы.", "WANT often comes at the end.", "ҚАЛАУ көбіне соңында."),
    },
    {
      id: 8, title: at("Чувства", "Feelings", "Сезімдер"),
      goal: at("Сказать, как вы себя чувствуете.", "Say how you feel.", "Көңіл-күйді айту."),
      words: ["рад", "грустный", "весёлый", "любить", "бояться", "злой", "спокойный", "хотеть"],
      phrases: [
        { ru: "Я рад тебя видеть", signs: ["я", "рад", "ты", "видеть"] },
        { ru: "Почему ты грустный?", signs: ["ты", "грустный", "почему"] },
      ],
      grammar: "face",
      extra: { to: "/face-trainer", label: at("Тренажёр мимики: вопрос, отрицание, эмоции", "Facial grammar trainer", "Мимика жаттықтырғышы") },
      tip: at("Чувства показывают и лицом: без мимики жест «весёлый» выглядит неестественно.", "Feelings are shown with the face too.", "Сезім бетпен де көрсетіледі."),
    },
    {
      id: 9, title: at("Здоровье", "Health", "Денсаулық"),
      goal: at("Сказать, что болит, и попросить помощи.", "Say what hurts and ask for help.", "Не ауыратынын айту."),
      words: ["голова", "болит", "боль", "помочь", "рука", "глаз", "сердце", "знать"],
      phrases: [
        { ru: "У меня болит голова", signs: ["я", "голова", "болит"] },
        { ru: "Помогите мне", signs: ["помочь", "я"], tip: "ПОМОЧЬ движется к тому, кому помогают." },
      ],
      grammar: "directional", dialogue: "health",
      tip: at("Место боли часто показывают прямо на теле.", "Where it hurts is often shown on the body.", "Ауырған жерді денеде көрсетеді."),
    },
    {
      id: 10, title: at("Учёба", "Studying", "Оқу"),
      goal: at("Говорить об учёбе и задавать вопросы.", "Talk about studying and ask questions.", "Оқу туралы айту."),
      words: ["изучить", "книга", "читать", "писать", "вопрос", "школа", "слово", "понять"],
      phrases: [
        { ru: "Я учусь в школе", signs: ["я", "школа", "изучить"] },
        { ru: "Я хочу изучить язык", signs: ["я", "язык", "изучить", "хотеть"] },
      ],
      grammar: "pronouns", dialogue: "study",
      tip: at("Если не поняли — нормально попросить показать ещё раз.", "It is fine to ask for a repeat.", "Қайта көрсетуді сұрау — қалыпты."),
    },
    {
      id: 11, title: at("Цвета и животные", "Colours and animals", "Түстер мен жануарлар"),
      goal: at("Описать предмет или животное.", "Describe a thing or an animal.", "Затты сипаттау."),
      words: ["красный", "белый", "черный", "синий", "кошка", "собака", "птица", "лошадь"],
      phrases: [
        { ru: "Белая кошка", signs: ["кошка", "белый"], tip: "Цвет — после предмета." },
        { ru: "У меня есть собака", signs: ["я", "собака"] },
      ],
      grammar: "adjectives",
      tip: at("Многие названия животных показывают их форму или движение.", "Many animal signs show their shape or movement.", "Жануар ымдары пішінін көрсетеді."),
    },
    {
      id: 12, title: at("Погода и времена года", "Weather and seasons", "Ауа райы"),
      goal: at("Поговорить о погоде.", "Talk about the weather.", "Ауа райы туралы айту."),
      words: ["погода", "хороший", "холодный", "тёплый", "зима", "лето", "весна", "осень"],
      phrases: [
        { ru: "Сегодня хорошая погода", signs: ["сегодня", "погода", "хороший"] },
        { ru: "Зимой холодно", signs: ["зима", "холодный"] },
      ],
      grammar: "time",
      tip: at("Фразу о погоде обычно начинают со времени: СЕГОДНЯ ПОГОДА ХОРОШИЙ.", "Weather talk starts with the time.", "Уақыттан басталады."),
    },
  ];
}
