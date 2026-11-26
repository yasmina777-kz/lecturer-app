import { Link } from "react-router-dom";
import { ArrowRight, Bookmark, Camera, Check, Hand, MessageCircle, Type } from "lucide-react";
import { at } from "../i18n/automation";
import { useChooseSignLang } from "../components/SignLangSwitcher";
import type { SignLang } from "../sign/signLanguage";
import { useSignProgress } from "../sign/useProgress";
import { lessonIds } from "../sign/catalog";
import "./sign-courses.css";

/** /learn without a language: the two sign languages as separate courses.
 * Each card opens its own course (/learn?lang=rsl|ksl); they never mix. */
export function SignCourses() {
  const [lang, choose] = useChooseSignLang();
  const { progress } = useSignProgress();
  const rslDone = lessonIds.filter((id) => progress[id]).length;
  let kslDone = 0;
  try {
    kslDone = Object.keys(JSON.parse(localStorage.getItem("ksl-course-progress-v1") ?? "{}")).length;
  } catch {
    /* no progress yet */
  }
  const courses: {
    code: SignLang;
    tag: string;
    title: string;
    sub: string;
    meta: string;
    image: string;
    items: [typeof Type, string][];
    done: string;
  }[] = [
    {
      code: "rsl",
      tag: "РЖЯ",
      title: at("Русский жестовый язык", "Russian Sign Language", "Орыс ым тілі"),
      sub: at("Уроки на русском", "Lessons in Russian", "Сабақтар орысша"),
      meta: at("33 буквы · 412 жестов · 3 уровня", "33 letters · 412 signs · 3 levels", "33 әріп · 412 ым · 3 деңгей"),
      image: "/images/learning/hands-alphabet.png",
      items: [
        [Type, at("Дактильная азбука", "Fingerspelling", "Дактиль әліпбиі")],
        [Hand, at("Слова по темам A1–B1", "Topic words A1–B1", "A1–B1 тақырыптық сөздер")],
        [MessageCircle, at("Диалоги и грамматика", "Dialogues and grammar", "Диалогтар мен грамматика")],
      ],
      done: rslDone ? at(`Пройдено уроков: ${rslDone}`, `Lessons done: ${rslDone}`, `Өтілген сабақ: ${rslDone}`) : "",
    },
    {
      code: "ksl",
      tag: "ҚЖЯ",
      title: at("Казахский жестовый язык", "Kazakh Sign Language", "Қазақ ым тілі"),
      sub: at("Уроки на казахском", "Lessons in Kazakh", "Сабақтар қазақша"),
      meta: at("42 буквы · 751 жест · 3 уровня", "42 letters · 751 signs · 3 levels", "42 әріп · 751 ым · 3 деңгей"),
      image: "/images/landing-v2/hand-circle.webp",
      items: [
        [Type, at("Казахская азбука, 42 буквы", "Kazakh alphabet, 42 letters", "Қазақ әліпбиі, 42 әріп")],
        [Hand, at("Слова SURDO.KZ по темам", "SURDO.KZ topic words", "SURDO.KZ тақырыптық сөздері")],
        [Camera, at("Фразы и диалоги с камерой", "Phrases and dialogues with camera", "Камерамен сөйлемдер мен диалогтар")],
      ],
      done: kslDone ? at(`Пройдено уроков: ${kslDone}`, `Lessons done: ${kslDone}`, `Өтілген сабақ: ${kslDone}`) : "",
    },
  ];
  return (
    <div className="sign-workspace sign-courses">
      <header className="sign-courses-head">
        <div>
          <span className="sign-courses-eyebrow">{at("Обучение", "Learning", "Оқу")}</span>
          <h1>{at("Курсы", "Courses", "Курстар")}</h1>
          <p>{at("У каждого языка своя азбука, словарь и прогресс.", "Each language has its own alphabet, dictionary and progress.", "Әр тілдің өз әліпбиі, сөздігі және үлгерімі бар.")}</p>
        </div>
        <ul className="sign-courses-stats">
          <li><b>2</b>{at("языка", "languages", "тіл")}</li>
          <li><b>75</b>{at("букв", "letters", "әріп")}</li>
          <li><b>1 160+</b>{at("жестов", "signs", "ым")}</li>
        </ul>
      </header>
      <div className="sign-courses-grid">
        {courses.map((c) => {
          const current = lang === c.code;
          return (
            <Link
              key={c.code}
              to={`/learn?lang=${c.code}`}
              className={`sign-course-card card-motion is-${c.code}${current ? " is-current" : ""}`}
              onClick={() => choose(c.code)}
            >
              <span className="sign-course-media">
                <img src={c.image} alt="" />
                <span className="sign-course-tag">{c.tag}</span>
                {current && (
                  <span className="sign-course-mark" title={at("Текущий курс", "Current course", "Ағымдағы курс")}>
                    <Bookmark size={16} fill="currentColor" />
                  </span>
                )}
              </span>
              <span className="sign-course-body">
                <strong>{c.title}</strong>
                <span className="sign-course-sub">{c.sub}</span>
                <span className="sign-course-meta">{c.meta}</span>
                <span className="sign-course-items">
                  {c.items.map(([Icon, text]) => (
                    <span key={text}>
                      <Icon size={15} /> {text}
                    </span>
                  ))}
                </span>
                {c.done && (
                  <span className="sign-course-done">
                    <Check size={14} /> {c.done}
                  </span>
                )}
                <span className="sign-course-open">
                  {current
                    ? at("Продолжить курс", "Continue course", "Курсты жалғастыру")
                    : at("Открыть курс", "Open course", "Курсты ашу")}
                  <ArrowRight size={17} />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
