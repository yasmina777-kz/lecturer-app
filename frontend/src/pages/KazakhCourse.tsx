import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, Home, MessagesSquare, Play, Search, Sprout, Turtle, UserRound, X } from "lucide-react";
import { WordPracticeCamera } from "../components/WordPracticeCamera";
import { loadKslWordModel } from "../sign/wordRecognizer";
import { KazakhTeacherSection, KslClip, teacherSegment, useTeacherLessons } from "./KazakhTeacher";
import { at } from "../i18n/automation";
import { useLanguage } from "../i18n";
import { shuffle } from "../sign/activities";
import { KK_WORDS } from "../sign/kazakhGlossary";
import { KK_WORDS_EXTRA } from "../sign/kazakhGlossaryExtra";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./fingerspell.css";
import "./course.css";

/** Kazakh Sign Language course built from real Kazakh signer videos of the
 * SURDO.KZ dictionary (YouTube embeds, the way surdo.kz shows them). One
 * topic = several lessons of up to 8 signs: watch (normal + slow) → quiz. */
export type KslEntry = { label: string; topic: string; youtube: string; slow?: string };
type Catalog = { entries: KslEntry[]; letters: { title: string; youtube: string }[] };

/** Learner-friendly order: everyday topics first. */
const ORDER = [
  "Сұрақ", "Отбасы", "Сандар", "Түс", "Мезгіл, уақыт", "Азық-түлік,тамақ,сусын ,төсек орын", "Сезім, қасиет, мінез",
  "Жан-жануарлар, жәндіктер", "Киім, аяқ киім, сән", "Денсаулық , медицина", "Мекеме, ғимарат", "Транспорт", "Ыдыс",
  "Оқу, білім беру", "Мамандық, жұмыс", "Ойын, спорт, би, ән", "Қимыл, іс-әрекет", "Сын-сапа, зат", "Салмақ, өлшем, жылдамдық",
  "Табиғат құбылысы, табиғат", "Техника", "Пән", "Мемлекет, ел, қала", "Рәміздер", "Қаржы", "Қылмыс, сот, отырысы", "Дін",
];
const TOPIC_RU: Record<string, string> = {
  "Сұрақ": "Вопросы и вежливость", "Отбасы": "Семья", "Сандар": "Числа", "Түс": "Цвета", "Мезгіл, уақыт": "Время и календарь",
  "Азық-түлік,тамақ,сусын ,төсек орын": "Еда и быт", "Сезім, қасиет, мінез": "Чувства и характер", "Жан-жануарлар, жәндіктер": "Животные",
  "Киім, аяқ киім, сән": "Одежда", "Денсаулық , медицина": "Здоровье", "Мекеме, ғимарат": "Здания и места", "Транспорт": "Транспорт",
  "Ыдыс": "Посуда", "Оқу, білім беру": "Учёба", "Мамандық, жұмыс": "Профессии", "Ойын, спорт, би, ән": "Спорт и досуг",
  "Қимыл, іс-әрекет": "Действия", "Сын-сапа, зат": "Признаки и предметы", "Салмақ, өлшем, жылдамдық": "Меры и скорость",
  "Табиғат құбылысы, табиғат": "Природа", "Техника": "Техника", "Пән": "Школьные предметы", "Мемлекет, ел, қала": "Страны и города",
  "Рәміздер": "Символы Казахстана", "Қаржы": "Деньги", "Қылмыс, сот, отырысы": "Право и суд", "Дін": "Религия",
};
const LESSON_SIZE = 8;
const PROGRESS = "ksl-course-progress-v1";

let catalog: Promise<Catalog> | null = null;
export function loadKslCatalog() {
  catalog ??= fetch("/research/ksl/surdo-catalog.json").then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });
  return catalog;
}
export function useKslCatalog() {
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadKslCatalog().then(setData, () => setError(true));
  }, []);
  return { data, error };
}

/** Russian meaning of a Kazakh label where our glossary knows it. */
const RU_OF = (() => {
  const m = new Map<string, string>();
  for (const [ru, kk] of [...Object.entries(KK_WORDS), ...Object.entries(KK_WORDS_EXTRA)])
    for (const v of kk.split(/\s*\/\s*|,\s*/)) {
      const k = v.replace(/\(.*?\)/g, "").trim().toLocaleLowerCase("kk");
      if (k && !m.has(k)) m.set(k, ru.replace(/[!?]$/, ""));
    }
  return m;
})();
export const ruOf = (label: string) => RU_OF.get(label.replace(/[!?]$/, "").trim().toLocaleLowerCase("kk"));

export type KslLesson = { id: number; topic: string; part: number; parts: number; words: KslEntry[] };
export function kslLessons(entries: KslEntry[]): KslLesson[] {
  const out: KslLesson[] = [];
  const topics = [...ORDER, ...new Set(entries.map((e) => e.topic).filter((t) => !ORDER.includes(t)))];
  for (const topic of topics) {
    const ws = entries.filter((e) => e.topic === topic);
    const parts = Math.ceil(ws.length / LESSON_SIZE);
    const size = Math.ceil(ws.length / parts); // even parts: no one-word lessons
    for (let p = 0; p < parts; p++)
      out.push({ id: out.length + 1, topic, part: p + 1, parts, words: ws.slice(p * size, (p + 1) * size) });
  }
  return out;
}
/** Kazakh course levels: the 27 dictionary topics in three steps of nine. */
export const KSL_LEVELS = () => [
  { id: "A1", name: at("Основы", "Basics", "Негіз"), desc: at("Вопросы, семья, числа, цвета, время, еда, чувства, животные, одежда", "Questions, family, numbers, colours, time, food, feelings, animals, clothes", "Сұрақ, отбасы, сан, түс, уақыт, тамақ, сезім, жануар, киім"), from: 0 },
  { id: "A2", name: at("Быт", "Everyday life", "Тұрмыс"), desc: at("Здоровье, город, транспорт, посуда, учёба, профессии, спорт, действия", "Health, city, transport, dishes, study, jobs, sport, actions", "Денсаулық, қала, көлік, ыдыс, оқу, мамандық, спорт, әрекет"), from: 9 },
  { id: "B1", name: at("Общество", "Society", "Қоғам"), desc: at("Меры, природа, техника, предметы, страны, символы, деньги, право, религия", "Measures, nature, technology, subjects, countries, symbols, money, law, religion", "Өлшем, табиғат, техника, пән, ел, рәміз, қаржы, құқық, дін"), from: 18 },
] as const;
export const kslTopicLevel = (topic: string) => {
  const i = ORDER.indexOf(topic);
  return i < 0 || i >= 18 ? "B1" : i >= 9 ? "A2" : "A1";
};

/** Generated illustration for a topic (public/images/ksl-topics, ORDER index). */
export const topicImage = (t: string) => {
  const i = ORDER.indexOf(t);
  return i < 0 ? null : `/images/ksl-topics/${String(i + 1).padStart(2, "0")}.webp`;
};
export const topicName = (t: string) => at(TOPIC_RU[t] ?? t, TOPIC_RU[t] ?? t, t);
export const readProgress = (): Record<number, number> => {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS) ?? "{}");
  } catch {
    return {};
  }
};
const saveProgress = (id: number, score: number) => {
  try {
    localStorage.setItem(PROGRESS, JSON.stringify({ ...readProgress(), [id]: score }));
  } catch {
    /* ignore */
  }
};

export function KslVideo({ id, slow = false }: { id: string; slow?: boolean }) {
  return (
    <iframe
      key={id}
      className="ksl-yt"
      src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&rel=0&playsinline=1&modestbranding=1`}
      title={slow ? "slow" : "sign"}
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  );
}

/** Lesson list shown on the course page in ҚЖЯ mode. */
/** One card per dictionary topic (its photo shown once); the topic's 8-word
 * lessons are the numbered buttons inside. */
export function KslTopicCards({ lessons, progress, next }: { lessons: KslLesson[]; progress: Record<number, number>; next: KslLesson }) {
  const topics: { topic: string; list: KslLesson[] }[] = [];
  for (const l of lessons) {
    const t = topics.find((x) => x.topic === l.topic);
    if (t) t.list.push(l);
    else topics.push({ topic: l.topic, list: [l] });
  }
  return (
    <div className="course-units ksl-topic-units">
      {topics.map(({ topic, list }, k) => {
        const done = list.filter((l) => progress[l.id] !== undefined).length;
        const go = list.find((l) => progress[l.id] === undefined) ?? list[0];
        const current = list.some((l) => l.id === next.id) && done < list.length;
        const words = list.flatMap((l) => l.words);
        return (
          <div key={topic} className={`panel course-unit card-motion${done === list.length ? " done" : ""}${current ? " current" : ""}`}>
            <Link className="course-unit-thumb" to={`/course/kz/${go.id}`}>
              {topicImage(topic) && <img src={topicImage(topic)!} alt="" loading="lazy" />}
              <span className="course-unit-num">{done === list.length ? <Check size={16} /> : (ORDER.indexOf(topic) + 1 || k + 1)}</span>
              {current && <span className="course-unit-now">{at("Сейчас", "Now", "Қазір")}</span>}
            </Link>
            <div className="course-unit-body">
              <strong>{topicName(topic)}</strong>
              <span>
                {at(`${words.length} жестов · ${list.length} ур.`, `${words.length} signs · ${list.length} lessons`, `${words.length} ым · ${list.length} сабақ`)}
                {done ? ` · ${done}/${list.length}` : ""}
              </span>
              <div className="course-unit-words">
                {words.slice(0, 4).map((w) => <i key={w.youtube}>{w.label.replace(/[!?]$/, "")}</i>)}
                {words.length > 4 && <i>+{words.length - 4}</i>}
              </div>
              {list.length > 1 && (
                <div className="ksl-parts" aria-label={at("Уроки темы", "Topic lessons", "Тақырып сабақтары")}>
                  {list.map((l) => (
                    <Link key={l.id} to={`/course/kz/${l.id}`} className={progress[l.id] !== undefined ? "done" : l.id === go.id ? "next" : ""}>
                      {progress[l.id] !== undefined ? <Check size={13} /> : l.part}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link className="course-unit-foot" to={`/course/kz/${go.id}`}>
              <span>
                {done === list.length
                  ? at("Пройдено", "Done", "Өтті")
                  : done
                    ? at(`Продолжить · урок ${go.part}`, `Continue · lesson ${go.part}`, `Жалғастыру · ${go.part}-сабақ`)
                    : at("Начать", "Start", "Бастау")}
              </span>
              {done === list.length ? <Check size={16} /> : <ArrowRight size={16} />}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

export function KazakhCourseList() {
  const { data, error } = useKslCatalog();
  const lessons = useMemo(() => (data ? kslLessons(data.entries) : []), [data]);
  const [params, setParams] = useSearchParams();
  const progress = readProgress();
  if (error) return <p className="translate-status error">{at("Не удалось загрузить казахский словарь.", "Could not load the Kazakh dictionary.", "Қазақ сөздігі жүктелмеді.")}</p>;
  if (!data) return <p>…</p>;
  const next = lessons.find((l) => progress[l.id] === undefined) ?? lessons[0];
  const done = lessons.filter((l) => progress[l.id] !== undefined).length;
  const levels = KSL_LEVELS();
  const level = levels.find((l) => l.id === params.get("level"))?.id ?? kslTopicLevel(next.topic);
  const levelLessons = lessons.filter((l) => kslTopicLevel(l.topic) === level);
  const levelNext = levelLessons.find((l) => progress[l.id] === undefined) ?? levelLessons[0];
  return (
    <>
      <div className="course-levels ksl-levels" role="tablist" aria-label={at("Уровень", "Level", "Деңгей")}>
        {levels.map((l, i) => {
          const own = lessons.filter((x) => kslTopicLevel(x.topic) === l.id);
          const d = own.filter((x) => progress[x.id] !== undefined).length;
          const Icon = [Sprout, Home, MessagesSquare][i];
          return (
            <button key={l.id} role="tab" data-level={l.id} aria-selected={l.id === level} onClick={() => setParams({ level: l.id }, { replace: true })} className="course-anim" style={{ "--i": i } as React.CSSProperties}>
              <span className="course-level-icon"><Icon size={20} /></span>
              <span className="course-level-text">
                <strong>{l.id} <em>{l.name}</em></strong>
                <span>{l.desc}</span>
              </span>
              <span className={`course-level-count${d === own.length ? " full" : ""}`}>{d === own.length ? <Check size={14} /> : `${d}/${own.length}`}</span>
            </button>
          );
        })}
      </div>
      <section className="ksl-course-intro ksl-banner">
        <div>
          <strong>
            {at(
              `${data.entries.length} жестов казахского жестового языка · ${lessons.length} уроков`,
              `${data.entries.length} Kazakh signs · ${lessons.length} lessons`,
              `Қазақ ым тілінің ${data.entries.length} ымы · ${lessons.length} сабақ`,
            )}
          </strong>
          <span>
            {at(
              "Видео носителей казахского жестового языка из словаря SURDO.KZ («Сурдосервер», при поддержке МОН РК).",
              "Videos of Kazakh signers from the SURDO.KZ dictionary (supported by the Ministry of Education).",
              "SURDO.KZ сөздігіндегі қазақ ым тілі иелерінің бейнелері (ҚР БҒМ қолдауымен).",
            )}{" "}
          </span>
          <span className="ksl-banner-progress">
            <i style={{ width: `${(done / lessons.length) * 100}%` }} />
          </span>
          <small>{at("Пройдено", "Done", "Өтілді")}: {done} / {lessons.length}</small>
        </div>
        <Link className="button primary" to={`/course/kz/${next.id}`}>
          <Play size={16} /> {done ? at("Продолжить", "Continue", "Жалғастыру") : at("Начать", "Start", "Бастау")}
        </Link>
      </section>
      <h2 className="ksl-teacher-h">
        {at(`Уровень ${level}: уроки по темам SURDO.KZ`, `Level ${level}: SURDO.KZ topic lessons`, `${level} деңгейі: SURDO.KZ тақырыптары`)}
      </h2>
      <KslTopicCards lessons={levelLessons} progress={progress} next={levelNext} />
      <KazakhTeacherSection />
    </>
  );
}

export function KazakhLessonPage() {
  const { id } = useParams();
  const { data, error } = useKslCatalog();
  const { language } = useLanguage();
  const lessons = useMemo(() => (data ? kslLessons(data.entries) : []), [data]);
  const lesson = lessons.find((l) => l.id === Number(id)) ?? lessons[0];
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [id]);
  if (error) return <p className="translate-status error">{at("Не удалось загрузить казахский словарь.", "Could not load the Kazakh dictionary.", "Қазақ сөздігі жүктелмеді.")}</p>;
  if (!lesson) return <p>…</p>;
  const next = lessons[lessons.indexOf(lesson) + 1];
  const showRu = language !== "kk";
  return (
    <div className="sign-workspace vocab fingerspell course">
      <Link className="text-link back-link" to="/course">
        <ArrowLeft size={16} /> {at("Все уроки ҚЖЯ", "All Kazakh SL lessons", "Барлық ҚЫТ сабақтары")}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ҚЖЯ · {at("УРОК", "LESSON", "САБАҚ")} {lesson.id} / {lessons.length}</span>
          <h1>
            {topicName(lesson.topic)}
            {lesson.parts > 1 ? ` · ${lesson.part}/${lesson.parts}` : ""}
          </h1>
          <p>{at("Жесты показывает носитель казахского жестового языка (SURDO.KZ).", "A Kazakh signer shows the signs (SURDO.KZ).", "Ымдарды қазақ ым тілін білетін адам көрсетеді (SURDO.KZ).")}</p>
        </div>
      </div>
      <ol className="course-steps">
        {[at("Новые жесты", "New signs", "Жаңа ымдар"), at("Узнай жест", "Recognise", "Ымды тану"), at("Готово", "Done", "Дайын")].map((s, k) => (
          <li key={k}>
            <button aria-current={k === step ? "step" : undefined} className={k < step ? "past" : ""} onClick={() => setStep(k)}>
              <span>{k < step ? <Check size={14} /> : k + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      {step === 0 ? (
        <Watch words={lesson.words} showRu={showRu} onNext={() => setStep(1)} />
      ) : step === 1 ? (
        <Quiz words={lesson.words} all={data!.entries} showRu={showRu} onDone={(s) => { saveProgress(lesson.id, s); setStep(2); }} />
      ) : (
        <section className="panel fs-done">
          <CheckCircle2 size={40} />
          <h2>{at("Урок пройден!", "Lesson complete!", "Сабақ аяқталды!")}</h2>
          <div className="fs-actions">
            {next && (
              <Link className="button primary" to={`/course/kz/${next.id}`}>
                {at("Следующий урок", "Next lesson", "Келесі сабақ")}: {topicName(next.topic)} <ArrowRight size={16} />
              </Link>
            )}
            <Link className="button secondary" to="/kazakh">{at("Казахский дактиль", "Kazakh fingerspelling", "Қазақ дактилі")}</Link>
          </div>
        </section>
      )}
      <p className="fs-credit">
        {at("Видео: ", "Videos: ", "Бейнелер: ")}
        <a href="http://surdo.kz/rus/" target="_blank" rel="noreferrer">SURDO.KZ «Сурдосервер»</a> ·{" "}
        <a href="https://www.youtube.com/user/surdoKazakhstan" target="_blank" rel="noreferrer">YouTube surdoKazakhstan</a>
      </p>
    </div>
  );
}

function Watch({ words, showRu, onNext }: { words: KslEntry[]; showRu: boolean; onNext: () => void }) {
  const [sel, setSel] = useState(0);
  const [slow, setSlow] = useState(false);
  const [other, setOther] = useState(false);
  const [camera, setCamera] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const teacher = useTeacherLessons().data;
  const w = words[sel];
  const ru = ruOf(w.label);
  const seg = teacherSegment(teacher, w.label);
  return (
    <div className="fs-round">
      <section className="panel fs-player">
        {other && seg ? <KslClip id={seg.youtube} start={seg.start} end={seg.end} /> : <KslVideo id={slow && w.slow ? w.slow : w.youtube} slow={slow} />}
        <strong className="course-word">{w.label.replace(/[!?]$/, "")}</strong>
        {showRu && ru && <span className="course-word-ru">{ru}</span>}
        {seg && (
          <button className="button secondary" aria-pressed={other} onClick={() => setOther((o) => !o)}>
            <UserRound size={16} /> {other ? at("Носитель SURDO.KZ", "SURDO.KZ signer", "SURDO.KZ") : at("Другой носитель", "Another signer", "Басқа адам көрсетеді")}
          </button>
        )}
        {w.slow && !other && (
          <button className="button secondary" onClick={() => setSlow((s) => !s)}>
            <Turtle size={16} /> {slow ? at("Обычная скорость", "Normal speed", "Қалыпты жылдамдық") : at("Медленно", "Slow", "Баяу")}
          </button>
        )}
      </section>
      <section className="panel fs-answer">
        <h2>{at("Посмотрите каждый жест и повторите его", "Watch each sign and repeat it", "Әр ымды қарап, қайталаңыз")}</h2>
        <div className="vocab-chips course-chips">
          {words.map((x, k) => (
            <button key={x.youtube} aria-pressed={k === sel} className={seen.has(k) ? "seen" : ""} onClick={() => { setSel(k); setSlow(false); setOther(false); setSeen((s) => new Set(s).add(k)); }}>
              {x.label.replace(/[!?]$/, "")}
            </button>
          ))}
        </div>
        <button className="button secondary" aria-pressed={camera} onClick={() => setCamera((c) => !c)}>
          <Camera size={16} /> {camera ? at("Скрыть камеру", "Hide camera", "Камераны жасыру") : at("Покажи сам — проверка камерой", "Sign it — camera check", "Өзің көрсет — камерамен тексеру")}
        </button>
        {camera && (
          <WordPracticeCamera
            target={w.label}
            choices={words.map((x) => x.label)}
            loadModel={loadKslWordModel}
            display={(l) => l.replace(/[!?]$/, "")}
          />
        )}
        <p className="fs-tip">{at(`Просмотрено: ${seen.size} из ${words.length}`, `Viewed: ${seen.size} of ${words.length}`, `${seen.size} / ${words.length}`)}</p>
        <button className="button primary" onClick={onNext}>
          {at("Проверить себя", "Check yourself", "Өзіңді тексер")} <ArrowRight size={16} />
        </button>
      </section>
    </div>
  );
}

function Quiz({ words, all, showRu, onDone }: { words: KslEntry[]; all: KslEntry[]; showRu: boolean; onDone: (score: number) => void }) {
  const items = useMemo(() => shuffle(words).slice(0, 6), [words]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const t = items[i];
  const options = useMemo(() => {
    if (!t) return [];
    const pool = words.length >= 4 ? words : all.filter((e) => e.topic === t.topic);
    const others = shuffle(pool.filter((e) => e.youtube !== t.youtube)).slice(0, 3);
    while (others.length < 3) others.push(shuffle(all.filter((e) => e.youtube !== t.youtube && !others.includes(e)))[0]);
    return shuffle([t, ...others]);
  }, [t, words, all]);
  if (!t)
    return (
      <section className="panel fs-done">
        <h2>{at("Проверка", "Check", "Тексеру")}: {score} / {items.length}</h2>
        <button className="button primary" onClick={() => onDone(score)}>{at("Дальше", "Next", "Келесі")} <ArrowRight size={16} /></button>
      </section>
    );
  return (
    <div className="fs-round">
      <section className="panel fs-player">
        {/* the clip shows the word in its top-left corner and YouTube shows the title: hide both */}
        <div className="ksl-quiz-video">
          <KslVideo id={t.youtube} />
          <span className="ksl-mask-title" aria-hidden="true" />
          <span className="ksl-mask-word" aria-hidden="true" />
        </div>
      </section>
      <section className="panel fs-answer">
        <span className="eyebrow">{i + 1} / {items.length}</span>
        <h2>{at("Что это за жест?", "Which sign is it?", "Бұл қандай ым?")}</h2>
        <div className="vocab-choices">
          {options.map((o) => (
            <button key={o.youtube} className={!picked ? "" : o.youtube === t.youtube ? "right" : o.youtube === picked ? "wrong" : ""} onClick={() => { if (picked) return; setPicked(o.youtube); if (o.youtube === t.youtube) setScore((s) => s + 1); }}>
              {o.label.replace(/[!?]$/, "")}
              {showRu && ruOf(o.label) && <small className="course-word-ru">{ruOf(o.label)}</small>}
            </button>
          ))}
        </div>
        {picked && (
          <>
            <p className={`vocab-feedback ${picked === t.youtube ? "ok" : "no"}`}>{picked === t.youtube ? <Check size={18} /> : <X size={18} />} {t.label}</p>
            <button className="button primary" onClick={() => { setPicked(null); setI((n) => n + 1); }}>{at("Дальше", "Next", "Келесі")} <ArrowRight size={16} /></button>
          </>
        )}
      </section>
    </div>
  );
}

/** Kazakh sign dictionary: search, topics, real Kazakh signer videos. */
/** Kazakh sign dictionary in two steps: pick a topic (or search), then watch
 * the words of that topic one by one. */
export function KazakhDictionary() {
  const { data, error } = useKslCatalog();
  const { language } = useLanguage();
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<string>("");
  const [index, setIndex] = useState(0);
  const [slow, setSlow] = useState(false);
  const lessons = useMemo(() => (data ? kslLessons(data.entries) : []), [data]);
  if (error) return <p className="translate-status error">{at("Не удалось загрузить казахский словарь.", "Could not load the Kazakh dictionary.", "Қазақ сөздігі жүктелмеді.")}</p>;
  if (!data) return <p>…</p>;
  const needle = q.trim().toLocaleLowerCase("kk");
  const topics = [...ORDER.filter((t) => data.entries.some((e) => e.topic === t)), ...new Set(data.entries.map((e) => e.topic).filter((t) => !ORDER.includes(t)))];
  const list = data.entries.filter(
    (e) =>
      (!topic || e.topic === topic) &&
      (!needle || e.label.toLocaleLowerCase("kk").includes(needle) || (ruOf(e.label) ?? "").toLocaleLowerCase("ru").includes(needle)),
  );
  const pick = (t: string) => { setTopic(t); setIndex(0); setSlow(false); setQ(""); };
  const search = (
    <div className="ksl-dict-search">
      <Search size={18} aria-hidden="true" />
      <input
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setIndex(0); }}
        placeholder={at("Найти слово: по-казахски или по-русски", "Find a word in Kazakh or Russian", "Сөзді табу: қазақша немесе орысша")}
      />
    </div>
  );
  if (!topic && !needle)
    return (
      <div className="ksl-dict-home">
        {search}
        <p className="ksl-dict-hint">
          {at(`${data.entries.length} жестов в ${topics.length} темах. Выберите тему:`, `${data.entries.length} signs in ${topics.length} topics. Choose a topic:`, `${topics.length} тақырыпта ${data.entries.length} ым. Тақырып таңдаңыз:`)}
        </p>
        <div className="ksl-topic-grid">
          {topics.map((t) => {
            const words = data.entries.filter((e) => e.topic === t);
            return (
              <button key={t} type="button" className="ksl-topic-card card-motion" onClick={() => pick(t)}>
                <span className={`ksl-topic-media${topicImage(t) ? " is-art" : ""}`}>
                  <img src={topicImage(t) ?? `https://i.ytimg.com/vi/${words[0].youtube}/mqdefault.jpg`} alt="" loading="lazy" />
                  <span className="ksl-topic-num">{at(`${words.length} жестов`, `${words.length} signs`, `${words.length} ым`)}</span>
                </span>
                <span className="ksl-topic-body">
                  <strong>{topicName(t)}</strong>
                  <span className="ksl-topic-words">{words.slice(0, 3).map((w) => w.label.replace(/[!?]$/, "")).join(" · ")}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="fs-credit">
          {at("Видео: ", "Videos: ", "Бейнелер: ")}
          <a href="http://surdo.kz/rus/" target="_blank" rel="noreferrer">SURDO.KZ «Сурдосервер»</a> (YouTube surdoKazakhstan)
        </p>
      </div>
    );
  const i = Math.min(index, Math.max(0, list.length - 1));
  const cur = list[i];
  const lesson = topic ? lessons.find((l) => l.topic === topic) : undefined;
  const go = (n: number) => { setIndex(n); setSlow(false); };
  return (
    <div className="ksl-dict-topic">
      <div className="ksl-dict-bar">
        <button type="button" className="text-link" onClick={() => pick("")}>
          <ArrowLeft size={16} /> {at("Все темы", "All topics", "Барлық тақырыптар")}
        </button>
        <h2>{topic ? topicName(topic) : at("Поиск", "Search", "Іздеу")} <small>{list.length}</small></h2>
        {lesson && (
          <Link className="button primary" to={`/course/kz/${lesson.id}`}>
            <Check size={16} /> {at("Пройти тест по теме", "Take the topic quiz", "Тақырып бойынша тест")}
          </Link>
        )}
      </div>
      {search}
      <div className="ksl-dict">
        <section className="panel fs-player">
          {cur ? (
            <>
              <KslVideo id={slow && cur.slow ? cur.slow : cur.youtube} slow={slow} />
              <strong className="course-word">{cur.label.replace(/[!?]$/, "")}</strong>
              {language !== "kk" && ruOf(cur.label) && <span className="course-word-ru">{ruOf(cur.label)}</span>}
              <div className="ksl-dict-nav">
                <button className="button secondary" disabled={i === 0} onClick={() => go(i - 1)} aria-label={at("Предыдущее слово", "Previous word", "Алдыңғы сөз")}>
                  <ArrowLeft size={16} />
                </button>
                <span>{i + 1} / {list.length}</span>
                {cur.slow && (
                  <button className="button secondary" onClick={() => setSlow((v) => !v)}>
                    <Turtle size={16} /> {slow ? at("Обычно", "Normal", "Қалыпты") : at("Медленно", "Slow", "Баяу")}
                  </button>
                )}
                <button className="button primary" disabled={i >= list.length - 1} onClick={() => go(i + 1)}>
                  {at("Дальше", "Next", "Келесі")} <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : (
            <p>{at("Ничего не найдено", "Nothing found", "Ештеңе табылмады")}</p>
          )}
        </section>
        <section className="panel ksl-dict-list">
          <ol>
            {list.slice(0, 120).map((e, n) => (
              <li key={e.youtube}>
                <button type="button" aria-current={n === i ? "true" : undefined} onClick={() => go(n)}>
                  <span className="ksl-dict-n">{n + 1}</span>
                  <span className="ksl-dict-w">
                    {e.label.replace(/[!?]$/, "")}
                    {language !== "kk" && ruOf(e.label) && <small>{ruOf(e.label)}</small>}
                  </span>
                  <Play size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
          {list.length > 120 && <p className="fs-tip">{at("Уточните поиск, чтобы увидеть остальные.", "Refine the search to see more.", "Көбірек көру үшін іздеуді нақтылаңыз.")}</p>}
        </section>
      </div>
    </div>
  );
}
