import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Check, PlayCircle, Target, X } from "lucide-react";
import { at } from "../i18n/automation";
import { OrderTask, SignChain } from "../components/SignChain";
import { GRAMMAR, type GrammarTask, type GrammarTrack } from "../sign/course";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./sign-grammar.css";
import "./grammar-steps.css";

const KEY = "rsl-grammar-progress-v1";
function readDone(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

export function SignGrammarPage() {
  const [params, setParams] = useSearchParams();
  const [done, setDone] = useState(readDone);
  const track: Exclude<GrammarTrack, "both"> = params.get("track") === "kzhr" ? "kzhr" : "rsl";
  const lessons = GRAMMAR.filter((l) => l.track === "both" || l.track === track);
  const id = params.get("lesson") ?? lessons[0].id;
  const index = Math.max(0, lessons.findIndex((l) => l.id === id));
  const lesson = lessons[index];
  const open = (lessonId: string, t = track) => setParams({ track: t, lesson: lessonId });
  const [example, setExample] = useState(0);
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [task, setTask] = useState(0);
  useEffect(() => {
    setExample(0);
    setResults({});
    setStep(0);
    setTask(0);
  }, [lesson.id]);
  const allAnswered = Object.keys(results).length === lesson.tasks.length;
  useEffect(() => {
    if (!allAnswered) return;
    const score = Object.values(results).filter(Boolean).length / lesson.tasks.length;
    const next = { ...readDone(), [lesson.id]: Math.max(score, readDone()[lesson.id] ?? 0) };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
    setDone(next);
  }, [allAnswered]);
  const ex = lesson.examples[example];
  return (
    <div className="sign-workspace vocab grammar">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {track === "kzhr"
              ? at("ГРАММАТИКА · КАЛЬКИРУЮЩАЯ ЖЕСТОВАЯ РЕЧЬ", "GRAMMAR · SIGNED RUSSIAN", "ГРАММАТИКА · КАЛЬКАЛАУШЫ ЫМ ТІЛІ")
              : at("ГРАММАТИКА · РАЗГОВОРНЫЙ РЖЯ", "GRAMMAR · RUSSIAN SIGN LANGUAGE", "ГРАММАТИКА · СӨЙЛЕУ РЖЯ")}
          </span>
          <h1>{lesson.title}</h1>
        </div>
        <div className="grammar-tracks" role="tablist" aria-label={at("Форма жестового языка", "Form of sign language", "Ым тілінің түрі")}>
          <button role="tab" aria-selected={track === "rsl"} onClick={() => open(lesson.track === "both" ? lesson.id : "two-forms", "rsl")}>
            {at("Разговорный РЖЯ", "Russian Sign Language", "Сөйлеу РЖЯ")}
          </button>
          <button role="tab" aria-selected={track === "kzhr"} onClick={() => open(lesson.track === "both" ? lesson.id : "two-forms", "kzhr")}>
            {at("КЖР (официальная)", "Signed Russian (official)", "КЖР (ресми)")}
          </button>
        </div>
      </div>
      <div className="grammar-layout gr-layout">
        <nav className="grammar-list gr-list" aria-label={at("Уроки грамматики", "Grammar lessons", "Грамматика сабақтары")}>
          {lessons.map((l, i) => (
            <button key={l.id} aria-current={l.id === lesson.id ? "page" : undefined} onClick={() => open(l.id)}>
              <span>{done[l.id] !== undefined ? <Check size={13} /> : i + 1}</span>
              {l.title}
            </button>
          ))}
        </nav>
        <section className="gr-main">
          <ol className="gr-steps">
            {[
              [BookOpen, at("Правило", "Rule", "Ереже")],
              [PlayCircle, at("Пример", "Example", "Мысал")],
              [Target, at("Упражнения", "Exercises", "Жаттығулар")],
            ].map(([Icon, name], i) => {
              const I = Icon as typeof BookOpen;
              return (
                <li key={i}>
                  <button className={i === step ? "now" : i < step ? "done" : ""} onClick={() => setStep(i as 0 | 1 | 2)}>
                    <span>{i < step ? <Check size={14} /> : <I size={15} />}</span>
                    {name as string}
                  </button>
                </li>
              );
            })}
          </ol>

          {step === 0 && (
            <div className="gr-card">
              <ol className="gr-points">
                {lesson.points.map((p) => {
                  const cut = p.search(/[.!?:]\s/);
                  const head = cut > 0 && cut < p.length - 2 ? p.slice(0, cut + 1) : p;
                  const rest = head === p ? "" : p.slice(head.length).trim();
                  return (
                    <li key={p}>
                      <span>{head}</span>
                      {rest && (
                        <details>
                          <summary>{at("Подробнее", "More", "Толығырақ")}</summary>
                          <p>{rest}</p>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ol>
              <div className="gr-actions">
                <button className="button primary" onClick={() => setStep(1)}>
                  {at("Посмотреть пример", "See an example", "Мысалды көру")}
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="gr-card gr-example">
              {lesson.examples.length > 1 && (
                <div className="gr-chips">
                  {lesson.examples.map((e, i) => (
                    <button key={e.ru} aria-pressed={i === example} onClick={() => setExample(i)}>{e.ru}</button>
                  ))}
                </div>
              )}
              <div className="gr-example-body">
                <div className="gr-example-text">
                  <strong>{ex.ru}</strong>
                  <div className="gr-gloss">
                    {(ex.gloss ? ex.gloss.split(/\s*\+\s*/) : ex.signs.map((s) => s.replace(/[!?]$/, "").toLocaleUpperCase("ru"))).map((g, i) => (
                      <span key={i}>{g}</span>
                    ))}
                  </div>
                  {ex.tip && <p className="gr-tip">{ex.tip}</p>}
                </div>
                <SignChain key={ex.ru} signs={ex.signs} compact />
              </div>
              <div className="gr-actions">
                <button className="button secondary" onClick={() => setStep(0)}><ArrowLeft size={18} />{at("К правилу", "Rule", "Ережеге")}</button>
                <button className="button primary" onClick={() => setStep(2)}>
                  {at("К упражнениям", "To exercises", "Жаттығуларға")}
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="gr-card gr-tasks">
              <div className="gr-progress" aria-label={`${Math.min(task + 1, lesson.tasks.length)} / ${lesson.tasks.length}`}>
                {lesson.tasks.map((_, i) => (
                  <i key={i} className={results[i] === true ? "ok" : results[i] === false ? "no" : i === task ? "now" : ""} />
                ))}
                <small>{Math.min(task + 1, lesson.tasks.length)} / {lesson.tasks.length}</small>
              </div>
              {lesson.tasks.map((t, i) =>
                i !== task ? null : (
                  <div key={`${lesson.id}-${i}`} className="grammar-task">
                    {t.kind === "order" ? (
                      <OrderTask ru={t.ru} answer={t.answer} also={t.also} why={t.why} onResult={(ok) => setResults((r) => ({ ...r, [i]: ok }))} />
                    ) : (
                      <Choice task={t} onResult={(ok) => setResults((r) => ({ ...r, [i]: ok }))} />
                    )}
                  </div>
                ),
              )}
              <div className="gr-actions">
                {results[task] !== undefined && task + 1 < lesson.tasks.length && (
                  <button className="button primary" onClick={() => setTask(task + 1)}>
                    {at("Следующее задание", "Next task", "Келесі тапсырма")}
                    <ArrowRight size={18} />
                  </button>
                )}
                {allAnswered &&
                  (lessons[index + 1] ? (
                    <button className="button primary" onClick={() => open(lessons[index + 1].id)}>
                      {at("Следующая тема", "Next topic", "Келесі тақырып")}
                      <ArrowRight size={18} />
                    </button>
                  ) : (
                    <Link className="button primary" to="/vocab?mode=phrases&lesson=0">{at("К фразам", "To phrases", "Сөйлемдерге")}<ArrowRight size={18} /></Link>
                  ))}
              </div>
            </div>
          )}
        </section>
      </div>
      <details className="panel grammar-sources">
        <summary>{at("Источники и оговорка", "Sources and disclaimer", "Дереккөздер")}</summary>
        <p>
          {at(
            "Правила составлены по учебной и научной литературе о русском жестовом языке:",
            "Rules are based on textbooks and research on Russian Sign Language:",
            "Ережелер оқулықтар мен зерттеулер бойынша жасалған:",
          )}
        </p>
        <ul>
          <li>Зайцева Г. Л. Жестовая речь. Дактилология: учебник для вузов. — М.: ВЛАДОС, 2000.</li>
          <li>Прозорова Е. В. Русский жестовый язык как лингвистический объект // Вопросы языкознания. — 2007. — № 1.</li>
          <li>Kimmelman V. Information Structure in Russian Sign Language and Sign Language of the Netherlands. — PhD thesis, University of Amsterdam, 2014.</li>
        </ul>
        <p>
          {at(
            "Это упрощённое введение. Жесты и грамматика различаются по регионам и между носителями; уроки не проверены сертифицированным переводчиком РЖЯ — уточняйте у преподавателя.",
            "This is a simplified introduction. Signs and grammar vary by region and signer; lessons are not reviewed by a certified RSL interpreter.",
            "Бұл жеңілдетілген кіріспе; ымдар аймаққа қарай өзгереді.",
          )}
        </p>
      </details>
    </div>
  );
}

function Choice({ task, onResult }: { task: Extract<GrammarTask, { kind: "choice" }>; onResult: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  // Stable shuffle per question, so the right answer is not always first.
  const order = useMemo(() => {
    let h = 0;
    for (const c of task.question) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const idx = task.options.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      h = (h * 1103515245 + 12345) >>> 0;
      const j = h % (i + 1);
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  }, [task.question, task.options.length]);
  return (
    <div className="grammar-choice">
      <p className="order-ru">{task.question}</p>
      <div className="vocab-choices">
        {order.map((i) => [task.options[i], i] as const).map(([o, i]) => (
          <button
            key={o}
            className={picked === null ? "" : i === task.correct ? "right" : i === picked ? "wrong" : ""}
            onClick={() => {
              if (picked !== null) return;
              setPicked(i);
              onResult(i === task.correct);
            }}
          >
            {o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <p className={`vocab-feedback ${picked === task.correct ? "ok" : "no"}`} role="status">
          {picked === task.correct ? <Check size={18} /> : <X size={18} />}
          {task.why}
        </p>
      )}
    </div>
  );
}
