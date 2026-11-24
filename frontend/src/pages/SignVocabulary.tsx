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
  "Общение": 1, "Семья и люди": 17, "Числа": 7, "Время": 29, "Каждый день": 31, "Еда и места": 27,
  "Учёба": 16, "Описание": 20, "Чувства": 21, "Тело и здоровье": 30, "Цвета и животные": 22,
  "Природа и погода": 32, "Действия": 15, "Понятия и предметы": 14,
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
      <div className="page-heading">
        <div>
          <span className="eyebrow">ҚЖЯ</span>
          <h1>{at("Тренажёр слов ҚЖЯ", "Kazakh SL word trainer", "Қазақ ым тілі сөздерінің жаттықтырғышы")}</h1>
          <p>
            {at("Повторяйте жесты по темам; проверка с вариантами ответа — в уроках курса.", "Review signs by topic; quizzes are in the course lessons.", "Ымдарды тақырып бойынша қайталаңыз; тест — курс сабақтарында.")}{" "}
            <Link className="text-link" to="/course">{at("К урокам ҚЖЯ", "To Kazakh SL lessons", "ҚЫТ сабақтарына")}</Link>
          </p>
        </div>
      </div>
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
      <section className="course-hero course-anim vocab-hero3">
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
        <div className="course-hero-art" aria-hidden="true">
          <div className="course-blob" />
          <img src="/images/landing-v2/mentor-pointing.webp" alt="" />
          <span className="course-bubble">{at("8 слов за урок ✌️", "8 words a lesson ✌️", "Сабақта 8 сөз ✌️")}</span>
        </div>
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
                <img className="topic-photo" src={`/illustrations/sign-phrases/phrase-${String(TOPIC_PHOTO[t.name] ?? 1).padStart(2, "0")}.jpg`} alt="" loading="lazy" />
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
    if (step !== "find" || picked) return;
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
  const stepNames: [Step, string][] = review
    ? [["recognize", at("Узнай жест", "Recognize", "Тану")]]
    : [
        ["learn", at("Посмотри", "Watch", "Көру")],
        ["recognize", at("Узнай жест", "Recognize", "Тану")],
        ["find", at("Найди видео", "Find the video", "Бейнені табу")],
        ["camera", at("Покажи сам", "Sign it", "Өзің көрсет")],
      ];
  return (
    <div className="sign-workspace vocab">
      <button className="sign-back" onClick={onExit}><ArrowLeft size={16} />{at("Все темы", "All topics", "Барлық тақырып")}</button>
      <div className="page-heading"><div><h1>{title}</h1></div></div>
      <ol className="vocab-steps">
        {stepNames.map(([id, name]) => (
          <li key={id} aria-current={step === id ? "step" : undefined}>{name}</li>
        ))}
      </ol>
      {step === "learn" && current && (
        <section className="panel vocab-learn">
          <div className="vocab-learn-media">
            <SignVideo word={current} rate={rate} mirror={mirror} replay={replay} />
            <div className="vocab-controls" role="group" aria-label={at("Управление видео", "Video controls", "Бейне басқару")}>
              {[0.5, 0.75, 1].map((r) => (
                <button key={r} aria-pressed={rate === r} onClick={() => setRate(r)}>{r === 1 ? "1×" : `${r}×`}</button>
              ))}
              <button aria-pressed={mirror} onClick={() => setMirror(!mirror)} title={at("Как в зеркале", "Mirror", "Айна")}>
                <FlipHorizontal2 size={16} />
              </button>
              <button onClick={() => setReplay(replay + 1)} title={at("Сначала", "Replay", "Басынан")}>
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
          <div className="vocab-card-side">
            <span className="eyebrow">{current.category} · {index + 1} / {words.length}</span>
            <h2>{wordText(current.label)}</h2>
            {tryCamera ? (
              // The camera opens right next to the video — no scrolling to find it.
              <div className="vocab-learn-camera vocab-learn-camera--side">
                <Suspense fallback={<Loading />}>
                  <WordPracticeCamera key={current.id} target={current.label} choices={words.map((w) => w.label)} />
                </Suspense>
                <button className="button secondary" onClick={() => setTryCamera(false)}>
                  <ArrowLeft size={18} />{at("Закрыть камеру", "Close camera", "Камераны жабу")}
                </button>
              </div>
            ) : (
              <>
            <ul className="vocab-tips">
                <li><Hand size={16} />{at("Форма кисти: какие пальцы согнуты?", "Handshape: which fingers bend?", "Қол пішіні: қай саусақтар бүгілген?")}</li>
                <li><Move size={16} />{at("Движение: куда и сколько раз?", "Movement: where and how many times?", "Қозғалыс: қайда және неше рет?")}</li>
                <li><Repeat size={16} />{at("Повторите 3 раза вместе с видео", "Repeat 3 times with the video", "Бейнемен бірге 3 рет қайталаңыз")}</li>
              </ul>
              <div className="vocab-chips" aria-label={at("Слова урока", "Lesson words", "Сабақ сөздері")}>
                {words.map((w, i) => (
                  <button key={w.id} aria-pressed={i === index} className={i < index ? "seen" : ""} onClick={() => { setIndex(i); setTryCamera(false); }}>
                    {wordText(w.label)}
                  </button>
                ))}
              </div>
              <div className="vocab-nav">
                <button className="button secondary" disabled={!index} onClick={() => { setIndex(index - 1); setTryCamera(false); }} aria-label={at("Назад", "Back", "Артқа")}><ArrowLeft size={18} /></button>
                <button className="button primary" onClick={() => { setTryCamera(false); next(); }}>
                  {index + 1 < words.length ? at("Следующий жест", "Next sign", "Келесі ым") : at("К проверке", "Start the quiz", "Тексеруге")}
                  <ArrowRight size={18} />
                </button>
    <button className="button secondary" onClick={() => setTryCamera(true)}>
                <Camera size={18} />{at("Попробовать с камерой", "Try with camera", "Камерамен көру")}
              </button>
            </div>
              </>
            )}
          </div>
        </section>
      )}
      {step === "recognize" && current && (
        <section className="panel vocab-card">
          <SignVideo word={current} rate={rate} mirror={mirror} />
          <div className="vocab-card-side">
            <span className="eyebrow">{index + 1} / {quizList.length}</span>
            <h2>{at("Что означает этот жест?", "What does this sign mean?", "Бұл ым нені білдіреді?")}</h2>
            <div className="vocab-choices">
              {choices.map((c) => (
                <button key={c.id} onClick={() => answer(c.id)} className={picked ? (c.id === current.id ? "right" : c.id === picked ? "wrong" : "") : ""}>
                  {wordText(c.label)}
                </button>
              ))}
            </div>
            <Feedback picked={picked} current={current} />
            {picked && <button className="button primary" onClick={next}>{at("Дальше", "Next", "Әрі қарай")}<ArrowRight size={18} /></button>}
          </div>
        </section>
      )}
      {step === "find" && current && (
        <section className="panel vocab-find vocab-find--game">
          <header className="vf-head">
            <div className="vf-progress" aria-label={`${index + 1} / ${quizList.length}`}>
              {quizList.map((_, i) => (
                <i key={i} className={i < index ? "done" : i === index ? "now" : ""} />
              ))}
            </div>
            <span className="vf-score" title={at("Верных ответов", "Correct answers", "Дұрыс жауаптар")}>✓ {score.right}</span>
          </header>
          <div className="vf-task">
            <span className="eyebrow">{at("Какое видео показывает жест?", "Which video shows the sign?", "Қай бейнеде осы ым?")}</span>
            <h2 key={current.id}>«{wordText(current.label)}»</h2>
            <p>{at("Наведите на видео, чтобы рассмотреть. Можно нажимать клавиши 1–4.", "Hover to look closer. Keys 1–4 work too.", "1–4 пернелерін басуға болады.")}</p>
          </div>
          <div className="vocab-video-choices vf-cards">
            {choices.map((c, k) => (
              <button key={c.id} onClick={() => answer(c.id)} className={`card-motion ${picked ? (c.id === current.id ? "right" : c.id === picked ? "wrong" : "dim") : ""}`}
                style={{ "--i": k } as React.CSSProperties}
                aria-label={picked ? wordText(c.label) : `${at("Вариант", "Option", "Нұсқа")} ${k + 1}`}>
                <span className="vf-num">{k + 1}</span>
                <SignVideo word={c} small />
                {picked && <span className="vf-label">{c.id === current.id ? "✓ " : ""}{wordText(c.label)}</span>}
              </button>
            ))}
          </div>
          <Feedback picked={picked} current={current} />
          {picked && <button className="button primary" onClick={next}>{at("Дальше", "Next", "Әрі қарай")}<ArrowRight size={18} /></button>}
        </section>
      )}
      {step === "camera" && (
        <section className="panel vocab-camera">
          <h2>{at("Покажите жесты сами", "Now sign them yourself", "Енді өзіңіз көрсетіңіз")}</h2>
          <p>{at("Выберите слово и покажите его в камеру. Этот шаг необязательный, но именно он учит говорить, а не только понимать.", "Pick a word and sign it to the camera. Optional, but it trains production, not just understanding.", "Сөзді таңдап, камераға көрсетіңіз.")}</p>
          <div className="vocab-chips">
            {words.map((w) => (
              <button key={w.id} aria-pressed={cameraWord?.id === w.id} onClick={() => setCameraWord(w)}>{wordText(w.label)}</button>
            ))}
          </div>
          {cameraWord && (
            <div className="vocab-camera-pair">
              <SignVideo word={cameraWord} small />
              <Suspense fallback={<Loading />}>
                <WordPracticeCamera key={cameraWord.id} target={cameraWord.label} choices={words.map((w) => w.label)} />
              </Suspense>
            </div>
          )}
          <button className="button primary" onClick={next}>{at("Завершить урок", "Finish lesson", "Сабақты аяқтау")}<ArrowRight size={18} /></button>
        </section>
      )}
      {step === "done" && (
        <section className="panel vocab-done">
          <GraduationCap size={36} />
          <h2>{at("Готово!", "Done!", "Дайын!")} {score.right} / {score.total}</h2>
          {score.missed.length > 0 ? (
            <>
              <p>{at("Эти жесты вернутся на повторение завтра:", "These signs come back for review tomorrow:", "Бұл ымдар ертең қайталанады:")}</p>
              <div className="vocab-chips">{[...new Set(score.missed)].map((w) => <span key={w.id}>{wordText(w.label)}</span>)}</div>
            </>
          ) : (
            <p>{at("Без ошибок. Слова вернутся на повторение через пару дней.", "No mistakes. The words will come back in a couple of days.", "Қатесіз. Сөздер бірнеше күннен кейін қайталанады.")}</p>
          )}
          <div className="vocab-nav">
            <button className="button secondary" onClick={onExit}><RotateCcw size={18} />{at("К темам", "Topics", "Тақырыптар")}</button>
            {onNext && <button className="button primary" onClick={onNext}>{at("Следующий урок", "Next lesson", "Келесі сабақ")}<ArrowRight size={18} /></button>}
            <Link className="button secondary" to="/dialogues">{at("Применить в диалоге", "Use in a dialogue", "Диалогта қолдану")}</Link>
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
