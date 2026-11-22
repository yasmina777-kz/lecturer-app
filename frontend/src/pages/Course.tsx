import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, Play, X } from "lucide-react";
import { at } from "../i18n/automation";
import { SignChain } from "../components/SignChain";
import { WordPracticeCamera } from "../components/WordPracticeCamera";
import { courseUnits, levelOf, type CefrLevel, type CourseUnit } from "../sign/courseUnits";
import { shuffle } from "../sign/activities";
import { useActivityCatalog } from "../sign/useActivities";
import type { DictionaryEntry } from "../sign/dictionary";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./fingerspell.css";
import "./sign-grammar.css";
import "./course.css";

const KEY = "rsl-course-v1";
type Progress = Record<string, { done?: boolean; step?: number; quiz?: number }>;
function readProgress(): Progress {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}
function save(id: number, patch: Progress[string]) {
  const p = readProgress();
  p[id] = { ...p[id], ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}
const STEPS = () => [
  at("Новые жесты", "New signs", "Жаңа ымдар"),
  at("Узнай жест", "Recognise", "Ымды тану"),
  at("Фразы", "Phrases", "Сөйлемдер"),
  at("Покажи сам", "Sign it", "Өзің көрсет"),
  at("Грамматика и диалог", "Grammar & dialogue", "Грамматика мен диалог"),
  at("Готово", "Done", "Дайын"),
];

const LEVELS: { id: CefrLevel; title: string; desc: string }[] = [
  { id: "A1", title: "A1", desc: "Выживание: знакомство, семья, числа, время, покупки, еда" },
  { id: "A2", title: "A2", desc: "Быт: люди, город, путешествия, неделя, ресторан, мнения" },
  { id: "B1", title: "B1", desc: "Связная речь: пространство, классификаторы, рассказ, мнение" },
  { id: "B2", title: "B2+", desc: "Свободное общение — нужен материал носителей" },
];

export function CoursePage() {
  const [params, setParams] = useSearchParams();
  const level = (LEVELS.find((l) => l.id === params.get("level"))?.id ?? "A1") as CefrLevel;
  const units = level === "B2" ? [] : courseUnits(level);
  const progress = readProgress();
  const next = units.find((u) => !progress[u.id]?.done) ?? units[units.length - 1];
  const levelDone = (l: CefrLevel) => l !== "B2" && courseUnits(l).every((u) => progress[u.id]?.done);
  const doneCount = units.filter((u) => progress[u.id]?.done).length;
  return (
    <div className="sign-workspace vocab course">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{at("КУРС ПО ШАГАМ", "STEP-BY-STEP COURSE", "ҚАДАМДЫҚ КУРС")} · {level}</span>
          <h1>{at("Русский жестовый язык с нуля", "Russian Sign Language from zero", "Нөлден бастап РЖЯ")}</h1>
          <p>
            {at(
              "Уровни A1 → A2 → B1 по шкале CEFR. В каждом уроке: новые жесты на видео носителей, проверка, фразы, показ в камеру или рассказ, грамматика и диалог.",
              "12 lessons in order: new signs, a check, phrases, the camera, grammar and a dialogue.",
              "12 сабақ ретімен.",
            )}
          </p>
        </div>
        {next && <Link className="button primary" to={`/course/${next.id}`}>
          <Play size={18} /> {doneCount ? at("Продолжить", "Continue", "Жалғастыру") : at("Начать", "Start", "Бастау")}: {next.title}
        </Link>}
      </div>
      <div className="course-levels" role="tablist">
        {LEVELS.map((l) => (
          <button key={l.id} role="tab" aria-selected={l.id === level} onClick={() => setParams({ level: l.id })}>
            <strong>{levelDone(l.id) ? "✓ " : ""}{l.title}</strong>
            <span>{l.desc}</span>
          </button>
        ))}
      </div>
      {level === "B2" ? (
        <section className="panel fs-answer">
          <h2>{at("B2 и выше: что нужно, чтобы сделать честно", "B2 and above", "B2 және жоғары")}</h2>
          <ul className="params-list">
            <li>Длинные живые рассказы и диалоги носителей в обычном темпе — их нет в открытых наборах данных.</li>
            <li>Классификаторы, ролевой сдвиг, юмор и региональные варианты — на видео, с разбором преподавателя.</li>
            <li>Профессиональная и абстрактная лексика (наука, право, медицина) — свыше 1000 жестов словаря.</li>
            <li>Проверка курса преподавателем РЖЯ и живая практика с носителями.</li>
          </ul>
          <p className="fs-tip">Пока лучший путь к B2 — пройти B1, а затем регулярно общаться с носителями: смотрите страницу «Самопроверка и практика».</p>
          <Link className="button primary" to="/live-practice">{at("Самопроверка и практика", "Self-check and practice", "Тәжірибе")}</Link>
        </section>
      ) : (<>
      <div className="course-progress">
        <div style={{ width: `${(doneCount / units.length) * 100}%` }} />
      </div>
      <p className="fs-tip">
        {at(`Пройдено уроков: ${doneCount} из ${units.length}`, `Lessons done: ${doneCount} of ${units.length}`, `${doneCount} / ${units.length}`)}
        {" · "}
        <Link to={`/learn-test?cefr=${level}`}>{at(`Итоговый тест ${level}`, `${level} test`, `${level} тесті`)}</Link>
      </p>
      {level === "A1" && <section className="course-before">
        <h2>{at("Перед стартом", "Before you start", "Бастамас бұрын")}</h2>
        <div className="course-before-grid">
          <Link className="panel" to="/culture"><strong>{at("Культура и этикет глухих", "Deaf culture and etiquette", "Керең мәдениеті")}</strong><span>{at("Как привлечь внимание, куда смотреть, как говорить о глухих", "How to get attention, eye contact, respectful words", "Назар аудару, көзге қарау")}</span></Link>
          <Link className="panel" to="/practice"><strong>{at("Азбука (дактиль)", "Alphabet", "Әліпби")}</strong><span>{at("33 буквы — чтобы показать своё имя", "33 letters to spell your name", "33 әріп")}</span></Link>
          <Link className="panel" to="/fingerspell"><strong>{at("Чтение дактиля", "Reading fingerspelling", "Дактильді оқу")}</strong><span>{at("Понимать имена по буквам", "Understand spelled names", "Есімдерді түсіну")}</span></Link>
        </div>
      </section>}
      <div className="course-units">
        {units.map((u) => {
          const p = progress[u.id];
          return (
            <Link key={u.id} className={`panel course-unit${p?.done ? " done" : ""}`} to={`/course/${u.id}`}>
              <span className="course-unit-num">{p?.done ? <CheckCircle2 size={22} /> : (u.id % 100)}</span>
              <div>
                <strong>{u.title}</strong>
                <span>{u.goal}</span>
                <small>{u.words.slice(0, 5).map((w) => w.replace(/[!?]$/, "")).join(" · ")}…</small>
              </div>
              <ArrowRight size={18} />
            </Link>
          );
        })}
      </div>
      </>)}
      <p className="fs-credit">
        {at(
          "Жесты — видео носителей РЖЯ (Slovo, Bukva · ai-forever). Порядок и правила — по учебной литературе; курс не проверен сертифицированным переводчиком.",
          "Signs are native-signer videos (Slovo, Bukva). Rules follow textbooks; not reviewed by a certified interpreter.",
          "Ымдар — Slovo, Bukva бейнелері.",
        )}
      </p>
    </div>
  );
}

export function CourseUnitPage() {
  const { id } = useParams();
  const all = courseUnits("all");
  const unit = all.find((u) => u.id === Number(id)) ?? all[0];
  const level = levelOf(unit.id);
  const units = courseUnits(level);
  const { data, error } = useActivityCatalog();
  const [step, setStep] = useState(() => Math.min(readProgress()[unit.id]?.step ?? 0, 5));
  const go = (s: number) => {
    setStep(s);
    save(unit.id, { step: s });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const entries = useMemo(() => {
    const byLabel = new Map((data?.entries ?? []).map((e) => [e.label, e]));
    return unit.words.map((w) => byLabel.get(w)).filter((e): e is DictionaryEntry => !!e);
  }, [data, unit]);
  if (error) return <p className="translate-status error">{error}</p>;
  const next = units[units.indexOf(unit) + 1];
  return (
    <div className="sign-workspace vocab fingerspell course">
      <Link className="text-link back-link" to={`/course?level=${level}`}>
        <ArrowLeft size={16} /> {at("Все уроки", "All lessons", "Барлық сабақ")} {level}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{level} · {at("УРОК", "LESSON", "САБАҚ")} {units.indexOf(unit) + 1} / {units.length}</span>
          <h1>{unit.title}</h1>
          <p>{unit.goal}</p>
        </div>
      </div>
      <ol className="course-steps">
        {STEPS().map((s, k) => [k === 3 && unit.speak ? at("Расскажи сам", "Tell it yourself", "Өзің айт") : s, k] as const).map(([s, k]) => (
          <li key={k}>
            <button aria-current={k === step ? "step" : undefined} className={k < step ? "past" : ""} onClick={() => go(k)}>
              <span>{k < step ? <Check size={14} /> : k + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      {!data ? (
        <p>…</p>
      ) : step === 0 ? (
        <WordsStep entries={entries} unit={unit} onNext={() => go(1)} />
      ) : step === 1 ? (
        <QuizStep entries={entries} all={data.entries} unit={unit} onNext={() => go(2)} />
      ) : step === 2 ? (
        <PhrasesStep unit={unit} onNext={() => go(3)} />
      ) : step === 3 ? (
        unit.speak ? <SpeakStep task={unit.speak} onNext={() => go(4)} /> : <CameraStep entries={entries} onNext={() => go(4)} />
      ) : step === 4 ? (
        <PracticeStep unit={unit} onNext={() => { save(unit.id, { done: true }); go(5); }} />
      ) : (
        <section className="panel fs-done">
          <CheckCircle2 size={40} />
          <h2>{at("Урок пройден!", "Lesson complete!", "Сабақ аяқталды!")}</h2>
          <p>{unit.tip}</p>
          <p className="fs-tip">
            {at(
              "Повторите жесты через день-два в «Тренажёре слов» — так они запомнятся надолго.",
              "Review these signs in a day or two in the word trainer.",
              "Бір-екі күннен кейін қайталаңыз.",
            )}
          </p>
          <div className="fs-actions">
            {next ? (
              <Link className="button primary" to={`/course/${next.id}`} onClick={() => save(unit.id, { done: true })}>
                {at("Следующий урок", "Next lesson", "Келесі сабақ")}: {next.title} <ArrowRight size={16} />
              </Link>
            ) : (
              <Link className="button primary" to={`/learn-test?cefr=${level}`}>{at(`Итоговый тест ${level}`, `${level} test`, `${level} тесті`)}</Link>
            )}
            <Link className="button secondary" to="/vocab">{at("Повторение", "Review", "Қайталау")}</Link>
          </div>
        </section>
      )}
    </div>
  );
}

function WordsStep({ entries, unit, onNext }: { entries: DictionaryEntry[]; unit: CourseUnit; onNext: () => void }) {
  const [sel, setSel] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const e = entries[sel];
  return (
    <div className="fs-round">
      <section className="panel fs-player">
        {e && <video key={e.id} className="test-video" src={e.displayVideo || e.video} autoPlay loop muted playsInline controls />}
        <strong className="course-word">{e?.label.replace(/[!?]$/, "")}</strong>
      </section>
      <section className="panel fs-answer">
        <h2>{at("Посмотрите каждый жест и повторите его", "Watch each sign and repeat it", "Әр ымды қарап, қайталаңыз")}</h2>
        <div className="vocab-chips course-chips">
          {entries.map((w, k) => (
            <button key={w.id} aria-pressed={k === sel} className={seen.has(k) ? "seen" : ""} onClick={() => { setSel(k); setSeen((s) => new Set(s).add(k)); }}>
              {w.label.replace(/[!?]$/, "")}
            </button>
          ))}
        </div>
        <p className="fs-tip">{unit.tip}</p>
        <p className="fs-tip">{at(`Просмотрено: ${seen.size} из ${entries.length}`, `Viewed: ${seen.size} of ${entries.length}`, `${seen.size} / ${entries.length}`)}</p>
        <button className="button primary" onClick={onNext}>
          {at("Проверить себя", "Check yourself", "Өзіңді тексер")} <ArrowRight size={16} />
        </button>
      </section>
    </div>
  );
}

function QuizStep({ entries, all, unit, onNext }: { entries: DictionaryEntry[]; all: DictionaryEntry[]; unit: CourseUnit; onNext: () => void }) {
  const items = useMemo(() => shuffle(entries).slice(0, 6), [entries]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const t = items[i];
  const options = useMemo(() => {
    if (!t) return [];
    const others = shuffle(entries.filter((e) => e.id !== t.id)).slice(0, 3);
    while (others.length < 3) others.push(shuffle(all.filter((e) => e.id !== t.id && !others.includes(e)))[0]);
    return shuffle([t, ...others]);
  }, [t, entries, all]);
  useEffect(() => {
    if (!t) save(unit.id, { quiz: score });
  }, [t]);
  if (!t) {
    return (
      <section className="panel fs-done">
        <h2>{at("Проверка", "Check", "Тексеру")}: {score} / {items.length}</h2>
        <p>{score >= items.length - 1 ? at("Отлично — жесты узнаются!", "Great!", "Тамаша!") : at("Можно вернуться к шагу «Новые жесты» и посмотреть ещё раз.", "You can go back to the new signs.", "Қайта қарауға болады.")}</p>
        <button className="button primary" onClick={onNext}>{at("К фразам", "To phrases", "Сөйлемдерге")} <ArrowRight size={16} /></button>
      </section>
    );
  }
  return (
    <div className="fs-round">
      <section className="panel fs-player">
        <video key={t.id + i} className="test-video" src={t.displayVideo || t.video} autoPlay loop muted playsInline controls />
      </section>
      <section className="panel fs-answer">
        <span className="eyebrow">{i + 1} / {items.length}</span>
        <h2>{at("Что это за жест?", "Which sign is it?", "Бұл қандай ым?")}</h2>
        <div className="vocab-choices">
          {options.map((o) => (
            <button key={o.id} className={!picked ? "" : o.id === t.id ? "right" : o.id === picked ? "wrong" : ""} onClick={() => { if (picked) return; setPicked(o.id); if (o.id === t.id) setScore((s) => s + 1); }}>
              {o.label.replace(/[!?]$/, "")}
            </button>
          ))}
        </div>
        {picked && (
          <>
            <p className={`vocab-feedback ${picked === t.id ? "ok" : "no"}`}>{picked === t.id ? <Check size={18} /> : <X size={18} />} {t.label.replace(/[!?]$/, "")}</p>
            <button className="button primary" onClick={() => { setPicked(null); setI((n) => n + 1); }}>{at("Дальше", "Next", "Келесі")} <ArrowRight size={16} /></button>
          </>
        )}
      </section>
    </div>
  );
}

function PhrasesStep({ unit, onNext }: { unit: CourseUnit; onNext: () => void }) {
  const [k, setK] = useState(0);
  const p = unit.phrases[k];
  return (
    <div className="fs-round">
      <section className="panel fs-player">
        <SignChain key={p.ru} signs={p.signs} compact />
      </section>
      <section className="panel fs-answer">
        <h2>{at("Фразы урока", "Lesson phrases", "Сабақ сөйлемдері")}</h2>
        <div className="vocab-chips">
          {unit.phrases.map((x, j) => (
            <button key={x.ru} aria-pressed={j === k} onClick={() => setK(j)}>{x.ru}</button>
          ))}
        </div>
        <p className="grammar-example">
          <strong>{p.ru}</strong>
          <span>{p.signs.map((s) => s.replace(/[!?]$/, "").toUpperCase()).join(" + ")}</span>
          {p.tip && <em>{p.tip}</em>}
        </p>
        <p className="fs-tip">{at("Повторите фразу вслед за видео — сначала медленно (0.5×), потом в обычном темпе.", "Repeat the phrase after the video, slowly first.", "Бейнеден кейін қайталаңыз.")}</p>
        <button className="button primary" onClick={onNext}>{at("Показать самому", "Sign it yourself", "Өзің көрсет")} <ArrowRight size={16} /></button>
      </section>
    </div>
  );
}

function CameraStep({ entries, onNext }: { entries: DictionaryEntry[]; onNext: () => void }) {
  const [sel, setSel] = useState(0);
  const e = entries[sel];
  return (
    <div className="course-camera">
      <section className="panel fs-answer">
        <h2>{at("Покажите жест в камеру — ИИ проверит", "Sign to the camera — AI checks it", "Камераға көрсетіңіз")}</h2>
        <p className="fs-tip">{at("Нужен Chrome и разрешение на камеру. Видео не покидает компьютер. Шаг можно пропустить.", "Chrome and camera permission needed. Video stays on your device. You may skip this step.", "Chrome және камера рұқсаты керек.")}</p>
        <div className="vocab-chips">
          {entries.map((w, k) => (
            <button key={w.id} aria-pressed={k === sel} onClick={() => setSel(k)}>{w.label.replace(/[!?]$/, "")}</button>
          ))}
        </div>
        <button className="button primary" onClick={onNext}>{at("Дальше", "Next", "Келесі")} <ArrowRight size={16} /></button>
      </section>
      {e && <WordPracticeCamera key={e.id} target={e.label} />}
    </div>
  );
}

function PracticeStep({ unit, onNext }: { unit: CourseUnit; onNext: () => void }) {
  return (
    <section className="panel fs-answer">
      <h2>{at("Закрепите в грамматике и диалоге", "Practise in grammar and a dialogue", "Грамматика мен диалогта бекітіңіз")}</h2>
      <div className="course-before-grid">
        {unit.grammar && (
          <Link className="panel" to={`/grammar?track=rsl&lesson=${unit.grammar}`} target="_blank">
            <strong>{at("Урок грамматики", "Grammar lesson", "Грамматика сабағы")}</strong>
            <span>{at("Правило и упражнения по теме", "Rule and exercises", "Ереже мен жаттығулар")}</span>
          </Link>
        )}
        {unit.dialogue && (
          <Link className="panel" to={`/dialogues?scenario=${unit.dialogue}`} target="_blank">
            <strong>{at("Диалог", "Dialogue", "Диалог")}</strong>
            <span>{at("Ответьте собеседнику в ситуации", "Reply in a situation", "Жағдаятта жауап беріңіз")}</span>
          </Link>
        )}
        {unit.extra && (
          <Link className="panel" to={unit.extra.to} target="_blank">
            <strong>{at("Дополнительно", "Extra", "Қосымша")}</strong>
            <span>{unit.extra.label}</span>
          </Link>
        )}
      </div>
      <p className="fs-tip">{at("Откроются в новой вкладке — вернитесь сюда, чтобы завершить урок.", "They open in a new tab — come back to finish.", "Жаңа қойындыда ашылады.")}</p>
      <button className="button primary" onClick={onNext}>
        <Circle size={14} /> {at("Завершить урок", "Finish the lesson", "Сабақты аяқтау")}
      </button>
    </section>
  );
}

function SpeakStep({ task, onNext }: { task: string; onNext: () => void }) {
  return (
    <section className="panel fs-answer">
      <h2>{at("Расскажите сами", "Tell it yourself", "Өзіңіз айтыңыз")}</h2>
      <p className="grammar-example"><strong>{task}</strong></p>
      <ol className="params-list">
        <li>{at("Продумайте 3–5 фраз и нужные жесты (найдите их в словаре).", "Plan 3–5 phrases and look up the signs.", "3–5 сөйлем ойлаңыз.")}</li>
        <li>{at("Запишите себя в «Зеркале» и пересмотрите: время в начале? пространство? мимика?", "Record yourself in the Mirror and review.", "Айнада жазыңыз.")}</li>
        <li>{at("Сохраните запись у себя и через неделю сравните — так виден прогресс.", "Keep the recording and compare in a week.", "Бір аптадан кейін салыстырыңыз.")}</li>
      </ol>
      <div className="fs-actions">
        <Link className="button secondary" to="/live-practice" target="_blank">{at("Открыть «Зеркало»", "Open the Mirror", "Айнаны ашу")}</Link>
        <button className="button primary" onClick={onNext}>{at("Дальше", "Next", "Келесі")} <ArrowRight size={16} /></button>
      </div>
      <p className="fs-tip">{at("Это задание без автоматической проверки: связный рассказ пока может оценить только человек — носитель или преподаватель.", "No automatic check: only a person can judge a story.", "Автоматты тексеру жоқ.")}</p>
    </section>
  );
}
