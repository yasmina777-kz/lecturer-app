import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Award, Check, CheckCircle2, Circle, Hand, Home, MessagesSquare, Mountain, Play, Sprout, Type, Users, X } from "lucide-react";
import { at } from "../i18n/automation";
import { SignChain, useWordCatalog } from "../components/SignChain";
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

const LEVELS: { id: CefrLevel; title: string; name: string; desc: string; icon: typeof Sprout }[] = [
  { id: "A1", title: "A1", name: "Выживание", desc: "Знакомство, семья, числа, время, покупки, еда", icon: Sprout },
  { id: "A2", title: "A2", name: "Быт", desc: "Люди, город, путешествия, неделя, ресторан, мнения", icon: Home },
  { id: "B1", title: "B1", name: "Связная речь", desc: "Пространство, классификаторы, рассказ, мнение", icon: MessagesSquare },
  { id: "B2", title: "B2+", name: "Свобода", desc: "Нужен материал носителей языка", icon: Mountain },
];

function Ring({ done, total }: { done: number; total: number }) {
  const r = 34, c = 2 * Math.PI * r, part = total ? done / total : 0;
  return (
    <div className="course-ring" aria-label={`${done} / ${total}`}>
      <svg viewBox="0 0 80 80" width="80" height="80">
        <circle cx="40" cy="40" r={r} className="track" />
        <circle cx="40" cy="40" r={r} className="bar" strokeDasharray={c} strokeDashoffset={c * (1 - part)} />
      </svg>
      <span><strong>{done}</strong>/{total}</span>
    </div>
  );
}

export function CoursePage() {
  const [params, setParams] = useSearchParams();
  const level = (LEVELS.find((l) => l.id === params.get("level"))?.id ?? "A1") as CefrLevel;
  const meta = LEVELS.find((l) => l.id === level)!;
  const units = level === "B2" ? [] : courseUnits(level);
  const progress = readProgress();
  const next = units.find((u) => !progress[u.id]?.done) ?? units[units.length - 1];
  const count = (l: CefrLevel) => (l === "B2" ? [0, 0] : [courseUnits(l).filter((u) => progress[u.id]?.done).length, courseUnits(l).length]);
  const doneCount = units.filter((u) => progress[u.id]?.done).length;
  const words = useWordCatalog();
  const poster = useMemo(() => new Map((words ?? []).map((w) => [w.label, w.poster])), [words]);
  return (
    <div className="sign-workspace vocab course" data-level={level}>
      <section className="course-hero course-anim">
        <div className="course-hero-text">
          <span className="eyebrow">{at("КУРС ПО ШАГАМ", "STEP-BY-STEP COURSE", "ҚАДАМДЫҚ КУРС")} · {level} · {meta.name}</span>
          <h1>{at("Русский жестовый язык с нуля", "Russian Sign Language from zero", "Нөлден бастап РЖЯ")}</h1>
          <p>
            {at(
              "Учитесь по шагам: смотрите жесты носителей, проверяйте себя, показывайте в камеру и закрепляйте в диалогах.",
              "Learn step by step: watch native signers, check yourself, sign to the camera, practise in dialogues.",
              "Қадаммен үйреніңіз.",
            )}
          </p>
          <div className="course-hero-actions">
            {next && (
              <Link className="button primary course-cta" style={{ background: "var(--lvl)", borderColor: "transparent", color: "#fff" }} to={`/course/${next.id}`}>
                <Play size={18} /> {doneCount ? at("Продолжить", "Continue", "Жалғастыру") : at("Начать", "Start", "Бастау")}: {next.title}
              </Link>
            )}
            {level !== "B2" && <Ring done={doneCount} total={units.length} />}
            {level !== "B2" && (
              <Link className="text-link" to={`/learn-test?cefr=${level}`}>
                <Award size={16} /> {at(`Итоговый тест ${level}`, `${level} test`, `${level} тесті`)}
              </Link>
            )}
          </div>
        </div>
        <div className="course-hero-art" aria-hidden="true">
          <div className="course-blob" />
          <img src="/images/landing-v2/mentor-wave.webp" alt="" />
          <span className="course-bubble">{at("Привет! 👋", "Hi! 👋", "Сәлем! 👋")}</span>
        </div>
      </section>

      <div className="course-levels" role="tablist" aria-label={at("Уровень", "Level", "Деңгей")}>
        {LEVELS.map((l, i) => {
          const [d, t] = count(l.id);
          const Icon = l.icon;
          return (
            <button key={l.id} role="tab" data-level={l.id} aria-selected={l.id === level} onClick={() => setParams({ level: l.id })} className="course-anim" style={{ "--i": i } as React.CSSProperties}>
              <span className="course-level-icon"><Icon size={20} /></span>
              <span className="course-level-text">
                <strong>{l.title} <em>{l.name}</em></strong>
                <span>{l.desc}</span>
              </span>
              {t > 0 && <span className={`course-level-count${d === t ? " full" : ""}`}>{d === t ? <Check size={14} /> : `${d}/${t}`}</span>}
            </button>
          );
        })}
      </div>

      {level === "B2" ? (
        <section className="panel fs-answer course-anim">
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
      ) : (
        <>
          {level === "A1" && (
            <section className="course-before">
              <h2>{at("Перед стартом", "Before you start", "Бастамас бұрын")}</h2>
              <div className="course-before-grid">
                {[
                  { to: "/culture", icon: Users, t: at("Культура и этикет глухих", "Deaf culture", "Керең мәдениеті"), d: at("Как привлечь внимание и общаться уважительно", "Etiquette and respectful words", "Әдеп") },
                  { to: "/practice", icon: Hand, t: at("Азбука (дактиль)", "Alphabet", "Әліпби"), d: at("33 буквы — чтобы показать своё имя", "33 letters for your name", "33 әріп") },
                  { to: "/fingerspell", icon: Type, t: at("Чтение дактиля", "Reading fingerspelling", "Дактильді оқу"), d: at("Понимать имена по буквам", "Understand spelled names", "Есімдерді түсіну") },
                ].map((c, i) => (
                  <Link key={c.to} className="panel course-before-card course-anim" to={c.to} style={{ "--i": i + 4 } as React.CSSProperties}>
                    <span className="course-before-icon"><c.icon size={20} /></span>
                    <span><strong>{c.t}</strong><span>{c.d}</span></span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <h2 className="course-section-title">{at("Уроки", "Lessons", "Сабақтар")} {level}</h2>
          <div className="course-units">
            {units.map((u, i) => {
              const done = progress[u.id]?.done;
              const current = !done && u.id === next?.id;
              const img = poster.get(u.words[0]) ?? poster.get(u.words[1]);
              return (
                <Link key={u.id} className={`panel course-unit${done ? " done" : ""}${current ? " current" : ""} course-anim`} to={`/course/${u.id}`} style={{ "--i": i + 6 } as React.CSSProperties}>
                  <div className="course-unit-thumb">
                    {img && <div className="course-unit-photo" style={{ backgroundImage: `url(${img})` }} />}
                    <span className="course-unit-num">{done ? <CheckCircle2 size={20} /> : i + 1}</span>
                    {current && <span className="course-unit-now">{at("Сейчас", "Now", "Қазір")}</span>}
                  </div>
                  <div className="course-unit-body">
                    <strong>{u.title}</strong>
                    <span>{u.goal}</span>
                    <div className="course-unit-words">
                      {u.words.slice(0, 4).map((w) => <i key={w}>{w.replace(/[!?]$/, "")}</i>)}
                      {u.words.length > 4 && <i>+{u.words.length - 4}</i>}
                    </div>
                  </div>
                  <div className="course-unit-foot">
                    <span>{done ? at("Пройден", "Done", "Өтті") : current ? at("Продолжить", "Continue", "Жалғастыру") : at("Открыть", "Open", "Ашу")}</span>
                    <ArrowRight size={16} />
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
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
