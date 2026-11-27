import { unitTile } from "../sign/courseUnits";
import { lazyPage } from "../lazyPage";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Flame,
  GraduationCap,
  Camera,
  FlipHorizontal2,
  Hand,
  Move,
  RotateCcw,
  Repeat,
  X,
  Eye,
  Search,
  MousePointerClick,
  Play,
  Lightbulb,
  MessageCircle,
  Users,
  Hash,
  Clock,
  Sun,
  UtensilsCrossed,
  BookOpen,
  Shapes,
  Smile,
  HeartPulse,
  PawPrint,
  CloudSun,
  Footprints,
  ArrowUpRight,
  Heart,
  Home,
  Baby,
  Calculator,
  Plus,
  Dice5,
  CalendarDays,
  Moon,
  Coffee,
  BedDouble,
  Croissant,
  MapPin,
  PenLine,
  Palette,
  Ruler,
  Star,
  Frown,
  Laugh,
  Stethoscope,
  Pill,
  Thermometer,
  Cat,
  Fish,
  Snowflake,
  Umbrella,
  Leaf,
  Car,
  Dumbbell,
  Key,
  Gift,
} from "lucide-react";
import { at } from "../i18n/automation";
import { getSignLang, useSignLang, wordText } from "../sign/signLanguage";
import { KazakhDictionary } from "./KazakhCourse";
import "../components/topic-art.css";
import { ProgressRing } from "../components/ProgressRing";
import "./course.css";

import { Loading } from "../components/UI";
import type { DictionaryEntry } from "../sign/dictionary";
import { dueIds, LEARNED_BOX, streak, useVocabProgress } from "../sign/vocabProgress";
import { PHRASE_LESSONS, PhraseSession } from "./PhraseLessons";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./vocab-lesson.css";

const WordPracticeCamera = lazyPage(() =>
  import("../components/WordPracticeCamera").then((m) => ({ default: m.WordPracticeCamera })),
);
const LESSON_SIZE = 8;
const LESSONS_SHOWN = 15;
type Word = DictionaryEntry;
type Step = "learn" | "recognize" | "find" | "camera" | "done";
const TOPIC_ORDER = [
  "Общение", "Семья и люди", "Числа", "Время", "Каждый день", "Еда и места",
  "Учёба", "Описание", "Чувства", "Тело и здоровье", "Цвета и животные", "Природа и погода",
  "Действия", "Понятия и предметы",
];

// Illustrated scenes of people signing, one per topic.
const TOPIC_PHOTO: Record<string, number> = {
  "Общение": 1, "Семья и люди": 54, "Числа": 3, "Время": 4, "Каждый день": 51, "Еда и места": 7,
  "Учёба": 10, "Описание": 35, "Чувства": 8, "Тело и здоровье": 52, "Цвета и животные": 11,
  "Природа и погода": 53, "Действия": 49, "Понятия и предметы": 50,
};
const TOPIC_ICONS: Record<string, [typeof Eye, (typeof Eye)[]]> = {
  "Общение": [Hand, [MessageCircle, Smile, Users]],
  "Семья и люди": [Users, [Heart, Home, Baby]],
  "Числа": [Hash, [Calculator, Plus, Dice5]],
  "Время": [Clock, [CalendarDays, Sun, Moon]],
  "Каждый день": [Sun, [Coffee, BedDouble, Home]],
  "Еда и места": [UtensilsCrossed, [Coffee, Croissant, MapPin]],
  "Учёба": [BookOpen, [PenLine, GraduationCap, Lightbulb]],
  "Описание": [Shapes, [Palette, Ruler, Star]],
  "Чувства": [Heart, [Smile, Frown, Laugh]],
  "Тело и здоровье": [HeartPulse, [Stethoscope, Pill, Thermometer]],
  "Цвета и животные": [PawPrint, [Palette, Cat, Fish]],
  "Природа и погода": [CloudSun, [Snowflake, Umbrella, Leaf]],
  "Действия": [Footprints, [Hand, Car, Dumbbell]],
  "Понятия и предметы": [Lightbulb, [Key, Gift, Star]],
};

/** Number that counts up from 0 when it first appears. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0) return setShown(value);
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min((t - start) / 900, 1);
      setShown(Math.round(value * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
}

function shuffle<T>(items: T[], seed = Math.random()) {
  const a = [...items];
  let s = Math.floor(seed * 2 ** 31) || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 48271) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function options(target: Word, pool: Word[], all: Word[]) {
  const same = pool.filter((w) => w.id !== target.id);
  const other = all.filter((w) => w.id !== target.id && !same.includes(w));
  return shuffle([target, ...shuffle(same).slice(0, 3), ...shuffle(other)].slice(0, 4));
}

function SignVideo({
  word, rate = 1, mirror = false, small = false, replay = 0,
}: { word: Word; rate?: number; mirror?: boolean; small?: boolean; replay?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
  }, [rate, word.video]);
  useEffect(() => {
    const v = ref.current;
    if (v && replay) {
      v.currentTime = 0;
      void v.play().catch(() => {});
    }
  }, [replay]);
  return (
    <video
      ref={ref}
      key={word.video}
      className={`vocab-video${small ? " small" : ""}${mirror ? " mirrored" : ""}`}
      src={word.displayVideo ?? word.video}
      poster={word.displayPoster ?? word.poster}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      onLoadedMetadata={(e) => (e.currentTarget.playbackRate = rate)}
      aria-label={at("Видеообразец жеста", "Sign reference video", "Ым бейнеүлгісі")}
    />
  );
}

export function SignVocabularyPage() {
  const [sl] = useSignLang();
  return sl === "ksl" ? <KazakhVocabulary /> : <SignVocabularyRsl />;
}

function KazakhVocabulary() {
  return (
    <div className="sign-workspace vocab fingerspell course">
      <section className="course-hero course-anim vocab-hero3 vocab-hero-photo">
        <img className="vocab-hero-photo-bg" src="/images/landing-v2/hands-detail.webp" alt="" />
        <div className="course-hero-text">
          <span className="eyebrow">{at("СЛОВАРНЫЙ ЗАПАС · ҚЖЯ", "VOCABULARY · KSL", "СӨЗДІК ҚОР · ҚЫТ")} · 751 {at("жест", "signs", "ым")} · 27 {at("тем", "topics", "тақырып")}</span>
          <h1>{at("Тренажёр слов ҚЖЯ", "Kazakh SL word trainer", "Қазақ ым тілі сөздерінің жаттықтырғышы")}</h1>
          <p>{at("Выберите тему и смотрите жесты носителей SURDO.KZ. Проверка с вариантами ответа и камерой — в уроках курса.", "Pick a topic and watch SURDO.KZ signers. Quizzes and camera checks are in the course lessons.", "Тақырып таңдап, SURDO.KZ ым иелерін көріңіз. Тест пен камера — курс сабақтарында.")}</p>
          <div className="course-hero-actions">
            <Link className="button primary course-cta" to="/course">
              <Play size={18} /> {at("К урокам ҚЖЯ", "To Kazakh SL lessons", "ҚЫТ сабақтарына")}
            </Link>
          </div>
        </div>
        <ul className="vocab-hero-facts" aria-hidden="true">
          <li><b>27</b>{at("тем словаря", "dictionary topics", "сөздік тақырыбы")}</li>
          <li><b>8</b>{at("слов за урок", "words a lesson", "сөз бір сабақта")}</li>
        </ul>
      </section>
      <KazakhDictionary />
    </div>
  );
}

function SignVocabularyRsl() {
  const [words, setWords] = useState<Word[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [params, setParams] = useSearchParams();
  const progress = useVocabProgress();
  useEffect(() => {
    fetch("/research/rsl/words/catalog.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((w: Word[]) => setWords(w))
      .catch(() => setFailed(true));
  }, []);
  const topics = useMemo(() => {
    if (!words) return [];
    const by = new Map<string, Word[]>();
    for (const w of words) by.set(w.category, [...(by.get(w.category) ?? []), w]);
    return [...by.entries()]
      .sort((a, b) => (TOPIC_ORDER.indexOf(a[0]) + 99) % 99 - (TOPIC_ORDER.indexOf(b[0]) + 99) % 99)
      .map(([name, list]) => ({
        name,
        lessons: Array.from({ length: Math.ceil(list.length / LESSON_SIZE) }, (_, i) =>
          list.slice(i * LESSON_SIZE, (i + 1) * LESSON_SIZE),
        ),
      }));
  }, [words]);
  if (failed)
    return <p className="sign-workspace">{at("Не удалось загрузить словарь.", "Could not load the dictionary.", "Сөздік жүктелмеді.")}</p>;
  if (!words) return <Loading />;
  const topic = params.get("topic"), lessonIndex = Number(params.get("lesson"));
  const mode = params.get("mode");
  const back = () => setParams({});
  if (mode === "review") {
    const ids = dueIds(progress.state);
    const list = ids.map((id) => words.find((w) => w.id === id)).filter((w): w is Word => !!w);
    return <Session key="review" title={at("Повторение", "Review", "Қайталау")} words={list} all={words} review onExit={back} progress={progress} />;
  }
  if (mode === "phrases" && PHRASE_LESSONS[lessonIndex])
    return (
      <PhraseSession
        key={`phrases:${lessonIndex}`}
        lesson={lessonIndex}
        onExit={back}
        onFinish={(score) => progress.finishLesson(`phrases:${lessonIndex}`, score)}
        onNext={PHRASE_LESSONS[lessonIndex + 1] ? () => setParams({ mode: "phrases", lesson: String(lessonIndex + 1) }) : undefined}
      />
    );
  const t = topics.find((x) => x.name === topic);
  if (t && Number.isInteger(lessonIndex) && t.lessons[lessonIndex])
    return (
      <Session
        key={`${topic}:${lessonIndex}`}
        title={`${t.name} · ${at("урок", "lesson", "сабақ")} ${lessonIndex + 1}`}
        words={t.lessons[lessonIndex]}
        all={words}
        lessonKey={`${t.name}:${lessonIndex}`}
        onExit={back}
        onNext={t.lessons[lessonIndex + 1] ? () => setParams({ topic: t.name, lesson: String(lessonIndex + 1) }) : undefined}
        progress={progress}
      />
    );
  return <Overview words={words} topics={topics} progress={progress} open={(name, i) => setParams({ topic: name, lesson: String(i) })} openPhrases={(i) => setParams({ mode: "phrases", lesson: String(i) })} review={() => setParams({ mode: "review" })} />;
}

type ProgressApi = ReturnType<typeof useVocabProgress>;
function Overview({
  words, topics, progress, open, openPhrases, review,
}: {
  words: Word[];
  topics: { name: string; lessons: Word[][] }[];
  progress: ProgressApi;
  open: (topic: string, lesson: number) => void;
  openPhrases: (lesson: number) => void;
  review: () => void;
}) {
  useSignLang();
  const s = progress.state;
  const learned = words.filter((w) => (s.words[w.id]?.box ?? 0) >= LEARNED_BOX).length;
  const started = words.filter((w) => s.words[w.id]).length;
  const due = dueIds(s, 999).length;
  const days = streak(s.days);
  const [expanded, setExpanded] = useState<string[]>([]);
  const nextUp = (() => {
    for (const t of topics)
      for (let i = 0; i < t.lessons.length; i++)
        if (s.lessons[`${t.name}:${i}`] === undefined) return { topic: t.name, lesson: i, words: t.lessons[i] };
    return null;
  })();
  return (
    <div className="sign-workspace vocab bento-page course" data-level="A1">
      <section className="course-hero course-anim vocab-hero3 vocab-hero-photo">
        <img className="vocab-hero-photo-bg" src="/images/landing-v2/hands-detail.webp" alt="" />
        <div className="course-hero-text">
          <span className="eyebrow">{at("СЛОВАРНЫЙ ЗАПАС", "VOCABULARY", "СӨЗДІК ҚОР")} · {words.length} {at("жестов", "signs", "ым")} · {topics.length} {at("тем", "topics", "тақырып")}</span>
          <h1>{getSignLang() === "ksl" ? at("Тренажёр слов ҚЖЯ", "Kazakh SL word trainer", "Қазақ ым тілі сөздерінің жаттықтырғышы") : at("Тренажёр слов РЖЯ", "RSL word trainer", "Орыс ым тілі сөздерінің жаттықтырғышы")}</h1>
          <p>{at("Уроки по 8 слов: смотрите жест, узнаёте его, находите среди других и показываете сами. Выученное вернётся на повторение.", "8-word lessons: watch, recognize, find and sign. Learned words come back for review.", "8 сөзден тұратын сабақтар.")}</p>
          <div className="course-hero-actions">
            {nextUp && (
              <button className="button primary course-cta" onClick={() => open(nextUp.topic, nextUp.lesson)}>
                <Play size={18} /> {started ? at("Продолжить", "Continue", "Жалғастыру") : at("Начать", "Start", "Бастау")}: {nextUp.topic} · {nextUp.lesson + 1}
              </button>
            )}
            <ProgressRing done={learned} total={words.length} />
            {due > 0 ? (
              <button className="text-link" onClick={review}><Repeat size={16} /> {at(`Повторить ${Math.min(due, 20)}`, `Review ${Math.min(due, 20)}`, `${Math.min(due, 20)} қайталау`)}</button>
            ) : (
              <span className="vocab-hero3-note"><GraduationCap size={16} /> {at("выучено слов", "words learned", "үйренілген сөз")}</span>
            )}
          </div>
        </div>
        <ul className="vocab-hero-facts" aria-hidden="true">
          <li><b>8</b>{at("слов за урок", "words a lesson", "сөз бір сабақта")}</li>
          <li><b>4</b>{at("шага: смотрю, узнаю, нахожу, показываю", "steps: watch, recognize, find, sign", "қадам: көру, тану, табу, көрсету")}</li>
        </ul>
      </section>
      <h2 className="vocab-section-title">{at("Темы", "Topics", "Тақырыптар")}</h2>
      <div className="vocab-topics vocab-topics-grid">
        {topics.map((t, k) => {
          const all = t.lessons.flat();
          const total = all.length;
          const done = all.filter((w) => (s.words[w.id]?.box ?? 0) >= LEARNED_BOX).length;
                    const first = t.lessons.findIndex((_, i) => s.lessons[`${t.name}:${i}`] === undefined);
          const go = first < 0 ? 0 : first;
          return (
            <section key={t.name} className="panel vocab-topic-card card-motion" style={{ "--i": k } as React.CSSProperties}>
              <header>
                <img className="topic-photo" src={unitTile(TOPIC_PHOTO[t.name] ?? 1)} alt="" loading="lazy" />
                <span className="vocab-topic-badge">{t.lessons.length} {at("уроков", "lessons", "сабақ")}</span>
              </header>
              <div className="vocab-topic-title">
                <h3>{t.name}</h3>
                <small>{t.lessons.length} {at("уроков", "lessons", "сабақ")} · {total} {at("слов", "words", "сөз")}</small>
              </div>
              <p className="vocab-card-words">
                {all.slice(0, 6).map((w) => wordText(w.label)).join(", ")}…
              </p>
              <div className="vocab-card-progress">
                <div className="vocab-bar"><span style={{ width: `${(100 * done) / total}%` }} /></div>
                <small>{done}/{total}</small>
              </div>
              <div className="vocab-card-lessons" aria-label={at("Уроки", "Lessons", "Сабақтар")}>
                {t.lessons.slice(0, expanded.includes(t.name) || t.lessons.length <= LESSONS_SHOWN + 1 ? undefined : LESSONS_SHOWN).map((ws, i) => {
                  const score = s.lessons[`${t.name}:${i}`];
                  return (
                    <button key={i} onClick={() => open(t.name, i)} className={score !== undefined ? "done" : i === go ? "next" : ""} title={`${at("Урок", "Lesson", "Сабақ")} ${i + 1}: ${ws.map((w) => wordText(w.label)).join(", ")}`}>
                      {score !== undefined ? <Check size={14} /> : i + 1}
                    </button>
                  );
                })}
                {t.lessons.length > LESSONS_SHOWN + 1 && !expanded.includes(t.name) && (
                  <button className="more" onClick={() => setExpanded((e) => [...e, t.name])} title={at("Показать все уроки", "Show all lessons", "Барлық сабақтар")}>
                    +{t.lessons.length - LESSONS_SHOWN}
                  </button>
                )}
              </div>
              <button className="vocab-card-go" onClick={() => open(t.name, go)}>
                {first < 0 ? at("Повторить урок 1", "Redo lesson 1", "1-сабақты қайталау") : first === 0 ? at("Начать урок 1", "Start lesson 1", "1-сабақты бастау") : `${at("Продолжить: урок", "Continue: lesson", "Жалғастыру: сабақ")} ${go + 1}`}
                <ArrowRight size={16} />
              </button>
            </section>
          );
        })}
      </div>
      <h2 className="vocab-section-title">{at("Фразы целиком", "Whole phrases", "Тұтас сөйлемдер")} <Link to="/grammar">{at("Грамматика →", "Grammar →", "Грамматика →")}</Link></h2>
      <div className="vocab-phrase-row">
        {PHRASE_LESSONS.map((ps, i) => {
          const score = s.lessons[`phrases:${i}`];
          return (
            <button key={i} className={`panel vocab-phrase${score !== undefined ? " done" : ""}`} onClick={() => openPhrases(i)} title={ps.map((p) => p.ru).join(" · ")}>
              <span className="vocab-phrase-num">{score !== undefined ? <Check size={14} /> : i + 1}</span>
              <span>
                <strong>{ps[0]?.ru}</strong>
                <small>{score !== undefined ? `${Math.round(score * 100)}%` : `${ps.length} ${at("фраз", "phrases", "сөйлем")}`}</small>
              </span>
            </button>
          );
        })}
      </div>
      <p className="vocab-note">
        {at(
          "Видео — реальные носители из открытого набора Slovo (лицензия в разделе источников). Прогресс хранится в этом браузере.",
          "Videos show real signers from the open Slovo dataset. Progress is stored in this browser.",
          "Бейнелер — Slovo ашық жинағындағы нақты адамдар. Прогресс осы браузерде сақталады.",
        )}
      </p>
    </div>
  );
}

function Session({
  title, words, all, review = false, lessonKey, onExit, onNext, progress,
}: {
  title: string;
  words: Word[];
  all: Word[];
  review?: boolean;
  lessonKey?: string;
  onExit: () => void;
  onNext?: () => void;
  progress: ProgressApi;
}) {
  useSignLang();
  const [step, setStep] = useState<Step>(review ? "recognize" : "learn");
  const [index, setIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [replay, setReplay] = useState(0);
  const [tryCamera, setTryCamera] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0, missed: [] as Word[] });
  const [cameraWord, setCameraWord] = useState<Word | null>(null);
  const order = useMemo(() => ({ recognize: shuffle(words), find: shuffle(words) }), [words]);
  // Warm the browser cache with every video of this lesson (each ~35 KB), so
  // the next sign starts instantly instead of waiting for the network.
  useEffect(() => {
    const controller = new AbortController();
    for (const w of words) void fetch(w.displayVideo ?? w.video, { signal: controller.signal }).catch(() => {});
    return () => controller.abort();
  }, [words]);
  const quizList = step === "find" ? order.find : order.recognize;
  const current = step === "learn" ? words[index] : quizList[index];
  const choices = useMemo(
    () => (current && (step === "recognize" || step === "find") ? options(current, words.length >= 4 ? words : all.filter((w) => w.category === current.category), all) : []),
    [current, step, words, all],
  );
  if (!words.length)
    return (
      <div className="sign-workspace vocab">
        <button className="sign-back" onClick={onExit}><ArrowLeft size={16} />{at("Назад", "Back", "Артқа")}</button>
        <p className="panel">{at("Сегодня повторять нечего — пройдите новый урок.", "Nothing to review today — take a new lesson.", "Бүгін қайталайтын ештеңе жоқ.")}</p>
      </div>
    );
  useEffect(() => {
    if ((step !== "find" && step !== "recognize") || picked) return;
    const onKey = (e: KeyboardEvent) => {
      const k = Number(e.key) - 1;
      if (k >= 0 && k < choices.length && !(e.target instanceof HTMLInputElement)) answer(choices[k].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  function answer(id: string) {
    if (picked || !current) return;
    setPicked(id);
    const ok = id === current.id;
    progress.answer(current.id, ok);
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1, missed: ok ? s.missed : [...s.missed, current] }));
  }
  function next() {
    setPicked(null);
    if (step === "camera") return setStep("done");
    if (index + 1 < (step === "learn" ? words.length : quizList.length)) return setIndex(index + 1);
    setIndex(0);
    if (step === "learn") setStep("recognize");
    else if (step === "recognize" && !review) setStep("find");
    else if (step === "recognize" || step === "find") {
      if (lessonKey) progress.finishLesson(lessonKey, score.total ? score.right / score.total : 0);
      setStep(review ? "done" : "camera");
    } else setStep("done");
  }
  const stepNames: [Step, string, string][] = review
    ? [["recognize", at("Узнай жест", "Recognize", "Тану"), at("Выберите значение", "Pick the meaning", "Мағынасын таңдаңыз")]]
    : [
        ["learn", at("Посмотри", "Watch", "Көру"), at("Смотрите и повторяйте", "Watch and repeat", "Қарап, қайталаңыз")],
        ["recognize", at("Узнай жест", "Recognize", "Тану"), at("Что он означает?", "What does it mean?", "Нені білдіреді?")],
        ["find", at("Найди видео", "Find the video", "Бейнені табу"), at("Выберите нужное видео", "Pick the right video", "Дұрыс бейнені таңдаңыз")],
        ["camera", at("Покажи сам", "Sign it", "Өзің көрсет"), at("По желанию, с камерой", "Optional, with camera", "Қаласаңыз, камерамен")],
      ];
  const stepIdx = step === "done" ? stepNames.length : stepNames.findIndex(([id]) => id === step);
  const total = step === "learn" ? words.length : quizList.length;
  const counted = step === "learn" || step === "recognize" || step === "find";
  const goTo = (i: number) => { setIndex(i); setTryCamera(false); };
  return (
    <div className="sign-workspace vocab vl">
      <header className="vl-top">
        <button className="vl-back" onClick={onExit}><ArrowLeft size={16} />{at("Все темы", "All topics", "Барлық тақырып")}</button>
        <h1>{title}</h1>
        {counted && (
          <span className="vl-count" aria-label={at("Прогресс шага", "Step progress", "Қадам барысы")}>
            <b>{index + 1}</b> / {total}
          </span>
        )}
      </header>
      <ol className="vl-steps">
        {stepNames.map(([id, name, hint], i) => (
          <li key={id} className={i < stepIdx ? "done" : i === stepIdx ? "now" : ""} aria-current={i === stepIdx ? "step" : undefined}>
            <span className="vl-dot">{i < stepIdx ? <Check size={15} /> : i + 1}</span>
            <span className="vl-step-text"><b>{name}</b><small>{hint}</small></span>
          </li>
        ))}
      </ol>
      {counted && (
        <div className="vl-bar" aria-hidden="true"><span style={{ width: `${(100 * (index + (picked || step === "learn" ? 1 : 0))) / total}%` }} /></div>
      )}
      {step === "learn" && current && (
        <section className="vl-card vl-learn">
          <div className="vl-media">
            <SignVideo word={current} rate={rate} mirror={mirror} replay={replay} />
            <div className="vl-controls" role="group" aria-label={at("Управление видео", "Video controls", "Бейне басқару")}>
              <div className="vl-seg">
                {[0.5, 0.75, 1].map((r) => (
                  <button key={r} aria-pressed={rate === r} onClick={() => setRate(r)} title={at("Скорость", "Speed", "Жылдамдық")}>{r === 1 ? "1×" : `${r}×`}</button>
                ))}
              </div>
              <button className="vl-tool" aria-pressed={mirror} onClick={() => setMirror(!mirror)}>
                <FlipHorizontal2 size={16} />{at("Зеркало", "Mirror", "Айна")}
              </button>
              <button className="vl-tool" onClick={() => setReplay(replay + 1)}>
                <RotateCcw size={16} />{at("Сначала", "Replay", "Басынан")}
              </button>
            </div>
          </div>
          <div className="vl-side">
            <span className="vl-kicker">{current.category}</span>
            <h2 className="vl-word">{wordText(current.label)}</h2>
            {tryCamera ? (
              <div className="vl-camera">
                <Suspense fallback={<Loading />}>
                  <WordPracticeCamera key={current.id} target={current.label} choices={words.map((w) => w.label)} />
                </Suspense>
                <button className="button secondary" onClick={() => setTryCamera(false)}>
                  <X size={18} />{at("Закрыть камеру", "Close camera", "Камераны жабу")}
                </button>
              </div>
            ) : (
              <div className="vl-howto">
                <h3>{at("Как запомнить", "How to remember it", "Қалай есте сақтау")}</h3>
                <ol>
                  <li><Hand size={18} /><span>{at("Посмотрите на форму кисти: какие пальцы согнуты", "Look at the handshape: which fingers bend", "Қол пішініне қараңыз: қай саусақтар бүгілген")}</span></li>
                  <li><Move size={18} /><span>{at("Заметьте движение: куда и сколько раз", "Notice the movement: where and how many times", "Қозғалысқа назар аударыңыз: қайда, неше рет")}</span></li>
                  <li><Repeat size={18} /><span>{at("Повторите жест 3 раза вместе с видео", "Repeat the sign 3 times with the video", "Ымды бейнемен бірге 3 рет қайталаңыз")}</span></li>
                </ol>
              </div>
            )}
            <div className="vl-actions">
              <button className="vl-prev" disabled={!index} onClick={() => goTo(index - 1)} aria-label={at("Предыдущий жест", "Previous sign", "Алдыңғы ым")}><ArrowLeft size={20} /></button>
              <button className="button primary vl-next" onClick={() => { setTryCamera(false); next(); }}>
                {index + 1 < words.length ? at("Следующий жест", "Next sign", "Келесі ым") : at("Перейти к проверке", "Start the quiz", "Тексеруге өту")}
                <ArrowRight size={20} />
              </button>
            </div>
            {!tryCamera && (
              <button className="vl-camera-link" onClick={() => setTryCamera(true)}>
                <Camera size={18} />
                <span><b>{at("Проверить себя на камере", "Check yourself on camera", "Камерамен тексеру")}</b><small>{at("Необязательно — ИИ подскажет, похоже ли", "Optional — AI tells you if it matches", "Міндетті емес")}</small></span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </section>
      )}
      {step === "learn" && (
        <nav className="vl-words" aria-label={at("Слова урока", "Lesson words", "Сабақ сөздері")}>
          <span>{at("Слова урока", "Lesson words", "Сабақ сөздері")}</span>
          {words.map((w, i) => (
            <button key={w.id} aria-current={i === index ? "true" : undefined} className={i < index ? "seen" : ""} onClick={() => goTo(i)}>
              {i < index && <Check size={13} />}{wordText(w.label)}
            </button>
          ))}
        </nav>
      )}
      {step === "recognize" && current && (
        <section className="vl-card vl-quiz">
          <div className="vl-media"><SignVideo word={current} rate={rate} mirror={mirror} /></div>
          <div className="vl-side">
            <span className="vl-kicker">{at("Вопрос", "Question", "Сұрақ")} {index + 1}</span>
            <h2 className="vl-q">{at("Что означает этот жест?", "What does this sign mean?", "Бұл ым нені білдіреді?")}</h2>
            <p className="vl-help">{at("Нажмите на правильный вариант или клавишу 1–4", "Click the right option or press 1–4", "Дұрыс нұсқаны басыңыз немесе 1–4")}</p>
            <div className="vl-choices">
              {choices.map((c, k) => (
                <button key={c.id} onClick={() => answer(c.id)} disabled={!!picked && c.id !== current.id && c.id !== picked}
                  className={picked ? (c.id === current.id ? "right" : c.id === picked ? "wrong" : "dim") : ""}>
                  <i>{k + 1}</i>{wordText(c.label)}
                </button>
              ))}
            </div>
            <Feedback picked={picked} current={current} />
            {picked && <button className="button primary vl-next" onClick={next}>{at("Дальше", "Next", "Әрі қарай")}<ArrowRight size={20} /></button>}
          </div>
        </section>
      )}
      {step === "find" && current && (
        <section className="vl-card vl-find">
          <div className="vl-find-task">
            <span className="vl-kicker">{at("Какое видео показывает жест?", "Which video shows the sign?", "Қай бейнеде осы ым?")}</span>
            <h2 key={current.id} className="vl-word">«{wordText(current.label)}»</h2>
            <p className="vl-help">{at("Нажмите на видео или клавишу 1–4", "Click a video or press 1–4", "Бейнені басыңыз немесе 1–4")}</p>
          </div>
          <div className="vl-video-choices">
            {choices.map((c, k) => (
              <button key={c.id} onClick={() => answer(c.id)} className={picked ? (c.id === current.id ? "right" : c.id === picked ? "wrong" : "dim") : ""}
                aria-label={picked ? wordText(c.label) : `${at("Вариант", "Option", "Нұсқа")} ${k + 1}`}>
                <i>{k + 1}</i>
                <SignVideo word={c} small />
                {picked && <span className="vl-video-label">{c.id === current.id ? "✓ " : ""}{wordText(c.label)}</span>}
              </button>
            ))}
          </div>
          <div className="vl-find-foot">
            <Feedback picked={picked} current={current} />
            {picked && <button className="button primary vl-next" onClick={next}>{at("Дальше", "Next", "Әрі қарай")}<ArrowRight size={20} /></button>}
          </div>
        </section>
      )}
      {step === "camera" && (
        <section className="vl-card vl-cam-step">
          <div className="vl-find-task">
            <span className="vl-kicker">{at("Последний шаг · по желанию", "Last step · optional", "Соңғы қадам · қалауыңызша")}</span>
            <h2 className="vl-q">{at("Покажите жесты сами", "Now sign them yourself", "Енді өзіңіз көрсетіңіз")}</h2>
            <p className="vl-help">{at("Выберите слово ниже и покажите его в камеру — так вы учитесь говорить, а не только понимать.", "Pick a word below and sign it to the camera — this trains speaking, not just understanding.", "Төменнен сөзді таңдап, камераға көрсетіңіз.")}</p>
          </div>
          <div className="vl-words vl-words--inline">
            {words.map((w) => (
              <button key={w.id} aria-current={cameraWord?.id === w.id ? "true" : undefined} onClick={() => setCameraWord(w)}>{wordText(w.label)}</button>
            ))}
          </div>
          {cameraWord ? (
            <div className="vl-cam-pair">
              <SignVideo word={cameraWord} small />
              <Suspense fallback={<Loading />}>
                <WordPracticeCamera key={cameraWord.id} target={cameraWord.label} choices={words.map((w) => w.label)} />
              </Suspense>
            </div>
          ) : (
            <p className="vl-empty"><Camera size={22} />{at("Сначала выберите слово", "Pick a word first", "Алдымен сөзді таңдаңыз")}</p>
          )}
          <div className="vl-find-foot">
            <button className="button primary vl-next" onClick={next}>{at("Завершить урок", "Finish lesson", "Сабақты аяқтау")}<ArrowRight size={20} /></button>
          </div>
        </section>
      )}
      {step === "done" && (
        <section className="vl-card vl-done">
          <span className="vl-done-icon"><GraduationCap size={34} /></span>
          <h2>{at("Урок пройден!", "Lesson complete!", "Сабақ аяқталды!")}</h2>
          <p className="vl-done-score"><b>{score.right}</b> / {score.total} {at("верных ответов", "correct answers", "дұрыс жауап")}</p>
          {score.missed.length > 0 ? (
            <>
              <p>{at("Эти жесты вернутся на повторение завтра:", "These signs come back for review tomorrow:", "Бұл ымдар ертең қайталанады:")}</p>
              <div className="vl-words vl-words--inline">{[...new Set(score.missed)].map((w) => <span key={w.id}>{wordText(w.label)}</span>)}</div>
            </>
          ) : (
            <p>{at("Без ошибок. Слова вернутся на повторение через пару дней.", "No mistakes. The words will come back in a couple of days.", "Қатесіз. Сөздер бірнеше күннен кейін қайталанады.")}</p>
          )}
          <div className="vl-done-actions">
            {onNext && <button className="button primary vl-next" onClick={onNext}>{at("Следующий урок", "Next lesson", "Келесі сабақ")}<ArrowRight size={20} /></button>}
            <Link className="button secondary" to="/dialogues">{at("Применить в диалоге", "Use in a dialogue", "Диалогта қолдану")}</Link>
            <button className="button secondary" onClick={onExit}><RotateCcw size={18} />{at("К темам", "Topics", "Тақырыптар")}</button>
          </div>
        </section>
      )}
    </div>
  );
}

function Feedback({ picked, current }: { picked: string | null; current: Word }) {
  useSignLang();
  if (!picked) return null;
  const ok = picked === current.id;
  return (
    <p className={`vocab-feedback ${ok ? "ok" : "no"}`} role="status">
      {ok ? <Check size={18} /> : <X size={18} />}
      {ok ? at("Верно!", "Correct!", "Дұрыс!") : `${at("Правильно", "Correct answer", "Дұрыс жауап")}: «${wordText(current.label)}»`}
    </p>
  );
}
