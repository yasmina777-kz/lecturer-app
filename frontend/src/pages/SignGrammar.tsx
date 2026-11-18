import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, X } from "lucide-react";
import { at } from "../i18n/automation";
import { OrderTask, SignChain } from "../components/SignChain";
import { GRAMMAR, type GrammarTask } from "../sign/course";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./sign-grammar.css";

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
  const id = params.get("lesson") ?? GRAMMAR[0].id;
  const index = Math.max(0, GRAMMAR.findIndex((l) => l.id === id));
  const lesson = GRAMMAR[index];
  const [example, setExample] = useState(0);
  const [results, setResults] = useState<Record<number, boolean>>({});
  useEffect(() => {
    setExample(0);
    setResults({});
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
          <span className="eyebrow">{at("ГРАММАТИКА РЖЯ", "RSL GRAMMAR", "РЖЯ ГРАММАТИКАСЫ")}</span>
          <h1>{lesson.title}</h1>
        </div>
      </div>
      <div className="grammar-layout">
        <nav className="grammar-list" aria-label={at("Уроки грамматики", "Grammar lessons", "Грамматика сабақтары")}>
          {GRAMMAR.map((l, i) => (
            <button key={l.id} aria-current={l.id === lesson.id ? "page" : undefined} onClick={() => setParams({ lesson: l.id })}>
              <span>{i + 1}</span>
              {l.title}
              {done[l.id] !== undefined && <Check size={15} className="grammar-done" />}
            </button>
          ))}
        </nav>
        <section className="panel grammar-rule">
          <div className="grammar-text">
          <ul>
            {lesson.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
          {lesson.examples.length > 1 && (
            <div className="vocab-chips">
              {lesson.examples.map((e, i) => (
                <button key={e.ru} aria-pressed={i === example} onClick={() => setExample(i)}>{e.ru}</button>
              ))}
            </div>
          )}
          <p className="grammar-example">
            <strong>{ex.ru}</strong>
            <span>{ex.signs.map((s) => s.replace(/[!?]$/, "").toLocaleUpperCase("ru")).join(" + ")}</span>
          </p>
          </div>
          <SignChain key={ex.ru} signs={ex.signs} compact />
        </section>
        <section className="panel grammar-tasks">
          <h2>{at("Упражнения", "Exercises", "Жаттығулар")}</h2>
          {lesson.tasks.map((t, i) => (
            <div key={`${lesson.id}-${i}`} className="grammar-task">
              {t.kind === "order" ? (
                <OrderTask ru={t.ru} answer={t.answer} also={t.also} why={t.why} onResult={(ok) => setResults((r) => ({ ...r, [i]: ok }))} />
              ) : (
                <Choice task={t} onResult={(ok) => setResults((r) => ({ ...r, [i]: ok }))} />
              )}
            </div>
          ))}
          {allAnswered && (
            <div className="grammar-next">
              {GRAMMAR[index + 1] ? (
                <button className="button primary" onClick={() => setParams({ lesson: GRAMMAR[index + 1].id })}>
                  {at("Следующая тема", "Next topic", "Келесі тақырып")}
                  <ArrowRight size={18} />
                </button>
              ) : (
                <Link className="button primary" to="/vocab?mode=phrases&lesson=0">{at("К фразам", "To phrases", "Сөйлемдерге")}<ArrowRight size={18} /></Link>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Choice({ task, onResult }: { task: Extract<GrammarTask, { kind: "choice" }>; onResult: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="grammar-choice">
      <p className="order-ru">{task.question}</p>
      <div className="vocab-choices">
        {task.options.map((o, i) => (
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
