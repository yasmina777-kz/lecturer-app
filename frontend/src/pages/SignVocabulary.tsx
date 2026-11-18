import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { at } from "../i18n/automation";
import { Loading } from "../components/UI";
import type { DictionaryEntry } from "../sign/dictionary";
import { dueIds, LEARNED_BOX, streak, useVocabProgress } from "../sign/vocabProgress";
import "./sign-workspace.css";
import "./sign-vocabulary.css";

const WordPracticeCamera = lazy(() =>
  import("../components/WordPracticeCamera").then((m) => ({ default: m.WordPracticeCamera })),
);
const LESSON_SIZE = 8;
type Word = DictionaryEntry;
type Step = "learn" | "recognize" | "find" | "camera" | "done";
const TOPIC_ORDER = [
  "Общение", "Семья и люди", "Числа", "Время", "Каждый день", "Еда и места",
  "Учёба", "Описание", "Чувства", "Тело и здоровье", "Цвета и животные", "Природа и погода",
];

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
      src={word.video}
      poster={word.poster}
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
  return <Overview words={words} topics={topics} progress={progress} open={(name, i) => setParams({ topic: name, lesson: String(i) })} review={() => setParams({ mode: "review" })} />;
}

type ProgressApi = ReturnType<typeof useVocabProgress>;
function Overview({
  words, topics, progress, open, review,
}: {
  words: Word[];
  topics: { name: string; lessons: Word[][] }[];
  progress: ProgressApi;
  open: (topic: string, lesson: number) => void;
  review: () => void;
}) {
  const s = progress.state;
  const learned = words.filter((w) => (s.words[w.id]?.box ?? 0) >= LEARNED_BOX).length;
  const started = words.filter((w) => s.words[w.id]).length;
  const due = dueIds(s, 999).length;
  const days = streak(s.days);
  return (
    <div className="sign-workspace vocab">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{at("СЛОВАРНЫЙ ЗАПАС", "VOCABULARY", "СӨЗДІК ҚОР")}</span>
          <h1>{at("Тренажёр слов РЖЯ", "RSL word trainer", "Ым сөздерінің жаттықтырғышы")}</h1>
          <p>
            {at(
              `${words.length} жестов по ${topics.length} темам. Каждый урок: посмотреть → узнать → найти → показать в камеру. Выученные слова возвращаются на повторение через 1, 2, 4, 8… дней.`,
              `${words.length} signs in ${topics.length} topics. Each lesson: watch → recognize → find → sign to the camera. Learned words come back for review after 1, 2, 4, 8… days.`,
              `${words.length} ым, ${topics.length} тақырып. Әр сабақ: көру → тану → табу → камераға көрсету.`,
            )}
          </p>
        </div>
      </div>
      <div className="vocab-stats">
        <div><GraduationCap size={20} /><strong>{learned}</strong><span>{at("выучено", "learned", "үйренілді")}</span></div>
        <div><Check size={20} /><strong>{started}</strong><span>{at("начато", "started", "басталды")}</span></div>
        <div><Repeat size={20} /><strong>{due}</strong><span>{at("к повторению", "due for review", "қайталауға")}</span></div>
        <div><Flame size={20} /><strong>{days}</strong><span>{at("дней подряд", "day streak", "күн қатарынан")}</span></div>
      </div>
      {due > 0 && (
        <button className="button primary vocab-review" onClick={review}>
          <Repeat size={18} />
          {at(`Повторить ${Math.min(due, 20)} слов`, `Review ${Math.min(due, 20)} words`, `${Math.min(due, 20)} сөзді қайталау`)}
        </button>
      )}
      <div className="vocab-topics">
        {topics.map((t) => {
          const total = t.lessons.flat().length;
          const done = t.lessons.flat().filter((w) => (s.words[w.id]?.box ?? 0) >= LEARNED_BOX).length;
          return (
            <section key={t.name} className="panel vocab-topic">
              <header>
                <h2>{t.name}</h2>
                <span>{done} / {total}</span>
              </header>
              <div className="vocab-bar"><span style={{ width: `${(100 * done) / total}%` }} /></div>
              <div className="vocab-lessons">
                {t.lessons.map((ws, i) => {
                  const score = s.lessons[`${t.name}:${i}`];
                  return (
                    <button key={i} onClick={() => open(t.name, i)} className={score !== undefined ? "done" : ""} title={ws.map((w) => w.label).join(", ")}>
                      <span>{at("Урок", "Lesson", "Сабақ")} {i + 1}</span>
                      <small>{score !== undefined ? `${Math.round(score * 100)}%` : ws.slice(0, 3).map((w) => w.label).join(", ") + "…"}</small>
                    </button>
                  );
                })}
              </div>
            </section>
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
    for (const w of words) void fetch(w.video, { signal: controller.signal }).catch(() => {});
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
            <h2>{current.label}</h2>
            <ul className="vocab-tips">
              <li><Hand size={16} />{at("Форма кисти: какие пальцы согнуты?", "Handshape: which fingers bend?", "Қол пішіні: қай саусақтар бүгілген?")}</li>
              <li><Move size={16} />{at("Движение: куда и сколько раз?", "Movement: where and how many times?", "Қозғалыс: қайда және неше рет?")}</li>
              <li><Repeat size={16} />{at("Повторите 3 раза вместе с видео", "Repeat 3 times with the video", "Бейнемен бірге 3 рет қайталаңыз")}</li>
            </ul>
            <div className="vocab-chips" aria-label={at("Слова урока", "Lesson words", "Сабақ сөздері")}>
              {words.map((w, i) => (
                <button key={w.id} aria-pressed={i === index} className={i < index ? "seen" : ""} onClick={() => { setIndex(i); setTryCamera(false); }}>
                  {w.label}
                </button>
              ))}
            </div>
            <div className="vocab-nav">
              <button className="button secondary" disabled={!index} onClick={() => { setIndex(index - 1); setTryCamera(false); }} aria-label={at("Назад", "Back", "Артқа")}><ArrowLeft size={18} /></button>
              <button className="button primary" onClick={() => { setTryCamera(false); next(); }}>
                {index + 1 < words.length ? at("Следующий жест", "Next sign", "Келесі ым") : at("К проверке", "Start the quiz", "Тексеруге")}
                <ArrowRight size={18} />
              </button>
              <button className="button secondary" aria-pressed={tryCamera} onClick={() => setTryCamera(!tryCamera)}>
                <Camera size={18} />{at("Попробовать с камерой", "Try with camera", "Камерамен көру")}
              </button>
            </div>
          </div>
          {tryCamera && (
            <div className="vocab-learn-camera">
              <Suspense fallback={<Loading />}>
                <WordPracticeCamera key={current.id} target={current.label} />
              </Suspense>
            </div>
          )}
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
                  {c.label}
                </button>
              ))}
            </div>
            <Feedback picked={picked} current={current} />
            {picked && <button className="button primary" onClick={next}>{at("Дальше", "Next", "Әрі қарай")}<ArrowRight size={18} /></button>}
          </div>
        </section>
      )}
      {step === "find" && current && (
        <section className="panel vocab-find">
          <span className="eyebrow">{index + 1} / {quizList.length}</span>
          <h2>{at("Найдите жест", "Find the sign", "Ымды табыңыз")}: «{current.label}»</h2>
          <div className="vocab-video-choices">
            {choices.map((c) => (
              <button key={c.id} onClick={() => answer(c.id)} className={picked ? (c.id === current.id ? "right" : c.id === picked ? "wrong" : "") : ""}
                aria-label={picked ? c.label : at("Вариант", "Option", "Нұсқа")}>
                <SignVideo word={c} small />
                {picked && <span>{c.label}</span>}
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
              <button key={w.id} aria-pressed={cameraWord?.id === w.id} onClick={() => setCameraWord(w)}>{w.label}</button>
            ))}
          </div>
          {cameraWord && (
            <div className="vocab-camera-pair">
              <SignVideo word={cameraWord} small />
              <Suspense fallback={<Loading />}>
                <WordPracticeCamera key={cameraWord.id} target={cameraWord.label} />
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
              <div className="vocab-chips">{[...new Set(score.missed)].map((w) => <span key={w.id}>{w.label}</span>)}</div>
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
  if (!picked) return null;
  const ok = picked === current.id;
  return (
    <p className={`vocab-feedback ${ok ? "ok" : "no"}`} role="status">
      {ok ? <Check size={18} /> : <X size={18} />}
      {ok ? at("Верно!", "Correct!", "Дұрыс!") : `${at("Правильно", "Correct answer", "Дұрыс жауап")}: «${current.label}»`}
    </p>
  );
}
