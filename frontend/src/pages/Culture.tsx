import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import { at } from "../i18n/automation";
import { shuffle } from "../sign/activities";
import { getSignLang, useSignLang } from "../sign/signLanguage";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./fingerspell.css";
import "./course.css";

/** Deaf culture and etiquette — what every course starts with. Widely accepted
 * conventions; local communities may differ. */
const SECTIONS = () => [
  getSignLang() === "ksl"
    ? {
        title: at("Глухие Казахстана — сообщество со своим языком", "Deaf people in Kazakhstan are a community with its own language", "Қазақстанның керең адамдары — өз тілі бар қауымдастық"),
        points: [
          at("Для многих глухих людей в Казахстане жестовый язык — родной. Он близок к русскому жестовому языку, но есть свои жесты и свой дактиль из 42 букв (Ә, Ғ, Қ, Ң, Ө, Ұ, Ү, Һ, І).", "For many Deaf people in Kazakhstan sign language is their first language. It is close to RSL but has its own signs and a 42-letter manual alphabet.", "Қазақстандағы көптеген керең адамдар үшін ым тілі — ана тілі. Ол орыс ым тіліне жақын, бірақ өз ымдары және 42 әріптен тұратын дактилі бар."),
          at("Жестовый язык — полноценный язык со своей грамматикой, а не «жесты к казахскому или русскому языку».", "Sign language is a full language with its own grammar.", "Ым тілі — өз грамматикасы бар толыққанды тіл."),
          at("В Казахстане работает Казахское общество глухих и его региональные отделения; есть государственные ресурсы: видеословарь «e-Ымдау» (ННПЦ РСИО) и словарь SURDO.KZ.", "Kazakhstan has the Kazakh Society of the Deaf with regional branches and state resources such as the «e-Ымдау» video dictionary and SURDO.KZ.", "Қазақстанда Қазақ керең адамдар қоғамы және оның өңірлік бөлімшелері жұмыс істейді; «e-Ымдау» бейнесөздігі мен SURDO.KZ сөздігі бар."),
        ],
      }
    : {
        title: at("Глухие — это сообщество со своим языком", "Deaf people are a community with its own language", "Керең адамдар — өз тілі бар қауымдастық"),
        points: [
          "Для многих глухих людей русский жестовый язык — родной. У сообщества глухих есть своя культура: театры, спорт (Сурдлимпийские игры), клубы, юмор и история.",
          "РЖЯ — полноценный язык со своей грамматикой, а не «жесты к русскому языку». В России он признан языком общения с 2012 года.",
          "Всероссийское общество глухих (ВОГ) работает с 1926 года и объединяет региональные отделения.",
        ],
      },
  {
    title: at("Какие слова использовать", "Which words to use", "Қандай сөздерді қолдану керек"),
    points: [
      "Говорите «глухой», «слабослышащий» или «человек с нарушением слуха».",
      "Слово «глухонемой» устарело и обижает: многие глухие говорят голосом, а жестовый язык — это речь, а не «немота».",
      "Тот, кто переводит, — «переводчик РЖЯ» или «сурдопереводчик».",
    ],
  },
  {
    title: at("Как привлечь внимание", "How to get attention", "Назар аудару"),
    points: [
      "Помашите рукой в поле зрения человека.",
      "Слегка коснитесь плеча или руки — не хватайте и не трясите.",
      "В комнате можно мигнуть светом или постучать по столу — вибрацию чувствуют.",
      "Не кричите и не подходите сзади внезапно.",
    ],
  },
  {
    title: at("Во время разговора", "During a conversation", "Әңгіме кезінде"),
    points: [
      "Смотрите в глаза: отвести взгляд — значит прервать собеседника. Мимика — часть грамматики, поэтому лицо важно видеть.",
      "Не закрывайте рот рукой и не жуйте — многие глухие читают по губам. Говорите в обычном темпе, не кричите и не «переигрывайте» губами.",
      "Свет должен падать на ваше лицо, а не из-за спины.",
      "Не поняли — попросите показать ещё раз или медленнее. Это нормально.",
    ],
  },
  {
    title: at("Если есть переводчик", "With an interpreter", "Аудармашы болса"),
    points: [
      "Обращайтесь к глухому человеку, а не к переводчику: «Как вас зовут?», а не «Спросите, как его зовут».",
      "Смотрите на собеседника, а не на переводчика.",
      "Делайте паузы: переводу нужно немного времени.",
    ],
  },
  {
    title: at("Жестовое имя", "Name sign", "Ым есім"),
    points: [
      "В сообществе глухих у людей есть жестовые имена — короткий жест вместо дактиля.",
      "Жестовое имя обычно дают глухие, его не придумывают себе сами. До этого имя показывают по буквам.",
    ],
  },
  {
    title: at("Видеосвязь", "Video calls", "Бейне байланыс"),
    points: [
      "Камера — так, чтобы были видны голова, руки и корпус до пояса.",
      "Однотонный фон и свет спереди; одежда однотонная, контрастная к рукам.",
    ],
  },
];
const QUIZ = () => [
  { q: "Как лучше привлечь внимание глухого человека?", options: ["Помахать рукой в поле зрения или коснуться плеча", "Громко позвать по имени", "Подойти сзади и взять за руку"], correct: 0 },
  { q: "Какое слово устарело и обижает?", options: ["«Глухонемой»", "«Глухой»", "«Слабослышащий»"], correct: 0 },
  { q: "Разговор через переводчика. К кому обращаться?", options: ["К глухому собеседнику", "К переводчику", "К обоим по очереди"], correct: 0 },
  { q: "Почему важно смотреть в глаза?", options: ["Отвести взгляд — значит прервать; мимика — часть грамматики", "Так требует вежливость, но это неважно", "Это не важно"], correct: 0 },
  { q: "Кто даёт жестовое имя?", options: ["Обычно глухие из сообщества", "Человек придумывает сам", "Его выдаёт школа"], correct: 0 },
  { q: "Жестовый язык (РЖЯ или ҚЖЯ) — это…", options: ["самостоятельный язык со своей грамматикой", "набор жестов к словам устного языка", "международный язык глухих"], correct: 0 },
];

export function CulturePage() {
  useSignLang();
  const quiz = useMemo(
    () =>
      QUIZ().map((t) => {
        const order = shuffle([...t.options.keys()]);
        return { q: t.q, options: order.map((k) => t.options[k]), correct: order.indexOf(t.correct) };
      }),
    [],
  );
  const [picked, setPicked] = useState<Record<number, number>>({});
  const score = quiz.filter((t, k) => picked[k] === t.correct).length;
  return (
    <div className="sign-workspace vocab fingerspell course culture">
      <Link className="text-link back-link" to="/course">
        <ArrowLeft size={16} /> {at("Курс", "Course", "Курс")}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{at("ПЕРЕД СТАРТОМ", "BEFORE YOU START", "БАСТАМАС БҰРЫН")}</span>
          <h1>{at("Культура и этикет глухих", "Deaf culture and etiquette", "Керең мәдениеті мен әдебі")}</h1>
          <p>{at("Язык — это люди. Эти правила помогут общаться уважительно с первого дня.", "Language is people. These rules help you communicate respectfully from day one.", "Тіл — бұл адамдар.")}</p>
        </div>
      </div>
      <div className="culture-sections">
        {SECTIONS().map((s) => (
          <section key={s.title} className="panel culture-section">
            <h2>{s.title}</h2>
            <ul>
              {s.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <section className="panel fs-answer culture-quiz">
        <h2>{at("Проверьте себя", "Check yourself", "Өзіңді тексер")}</h2>
        {quiz.map((t, k) => (
          <div key={t.q} className="grammar-task">
            <p className="order-ru">{t.q}</p>
            <div className="vocab-choices">
              {t.options.map((o, j) => (
                <button
                  key={o}
                  className={picked[k] === undefined ? "" : j === t.correct ? "right" : j === picked[k] ? "wrong" : ""}
                  onClick={() => picked[k] === undefined && setPicked((p) => ({ ...p, [k]: j }))}
                >
                  {o}
                </button>
              ))}
            </div>
            {picked[k] !== undefined && (
              <p className={`vocab-feedback ${picked[k] === t.correct ? "ok" : "no"}`}>
                {picked[k] === t.correct ? <Check size={18} /> : <X size={18} />} {t.options[t.correct]}
              </p>
            )}
          </div>
        ))}
        {Object.keys(picked).length === quiz.length && (
          <p className="fs-score" style={{ fontSize: "2rem" }}>
            {score} / {quiz.length}
          </p>
        )}
        <Link className="button primary" to="/course/1">{at("К первому уроку", "To lesson 1", "Бірінші сабаққа")}</Link>
      </section>
      <p className="fs-credit">
        {at(
          getSignLang() === "ksl"
            ? "Это общепринятые правила; в разных городах и сообществах привычки могут отличаться — уточняйте у местного общества глухих."
            : "Это общепринятые правила; в разных городах и сообществах привычки могут отличаться — уточняйте у местного отделения ВОГ.",
          "These are common conventions; local communities may differ.",
          "Бұл жалпы ережелер.",
        )}
      </p>
    </div>
  );
}
