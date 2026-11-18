import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, GraduationCap, X } from "lucide-react";
import { at } from "../i18n/automation";
import { OrderTask, SignChain } from "../components/SignChain";
import { PHRASES, type PhraseItem } from "../sign/course";

export const PHRASE_LESSON_SIZE = 6;
export const PHRASE_LESSONS: PhraseItem[][] = Array.from(
  { length: Math.ceil(PHRASES.length / PHRASE_LESSON_SIZE) },
  (_, i) => PHRASES.slice(i * PHRASE_LESSON_SIZE, (i + 1) * PHRASE_LESSON_SIZE),
);
type Step = "learn" | "quiz" | "order" | "done";

function pick<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function PhraseSession({
  lesson, onExit, onNext, onFinish,
}: {
  lesson: number;
  onExit: () => void;
  onNext?: () => void;
  onFinish: (score: number) => void;
}) {
  const items = PHRASE_LESSONS[lesson];
  const orderItems = useMemo(() => items.filter((p) => p.signs.length > 1), [items]);
  const quiz = useMemo(() => pick(items), [items]);
  const [step, setStep] = useState<Step>("learn");
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [answered, setAnswered] = useState(false);
  const list = step === "learn" ? items : step === "quiz" ? quiz : orderItems;
  const cur = list[i];
  const choices = useMemo(
    () => (step === "quiz" && cur ? pick([cur, ...pick(PHRASES.filter((p) => p.ru !== cur.ru)).slice(0, 3)]) : []),
    [step, cur],
  );
  const mark = (ok: boolean) => setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
  function next() {
    setPicked(null);
    setAnswered(false);
    if (i + 1 < list.length) return setI(i + 1);
    setI(0);
    if (step === "learn") setStep("quiz");
    else if (step === "quiz" && orderItems.length) setStep("order");
    else {
      onFinish(score.total ? score.right / score.total : 0);
      setStep("done");
    }
  }
  const steps: [Step, string][] = [
    ["learn", at("Посмотри", "Watch", "Көру")],
    ["quiz", at("Пойми фразу", "Understand", "Түсіну")],
    ["order", at("Собери фразу", "Build it", "Құрастыру")],
  ];
  return (
    <div className="sign-workspace vocab">
      <button className="sign-back" onClick={onExit}><ArrowLeft size={16} />{at("Все темы", "All topics", "Барлық тақырып")}</button>
      <div className="page-heading"><div><h1>{at("Фразы", "Phrases", "Сөйлемдер")} · {at("урок", "lesson", "сабақ")} {lesson + 1}</h1></div></div>
      <ol className="vocab-steps">
        {steps.map(([id, name]) => <li key={id} aria-current={step === id ? "step" : undefined}>{name}</li>)}
      </ol>
      {step !== "done" && cur && (
        <section className="panel phrase-card">
          <SignChain key={`${step}-${i}`} signs={cur.signs} />
          <div className="phrase-side">
            <span className="eyebrow">{i + 1} / {list.length}</span>
            {step === "learn" && (
              <>
                <h2>{cur.ru}</h2>
                <p className="phrase-gloss">{cur.signs.map((s) => s.replace(/[!?]$/, "").toLocaleUpperCase("ru")).join(" + ")}</p>
                {cur.tip && <p className="phrase-tip">{cur.tip}</p>}
                <button className="button primary" onClick={next}>
                  {i + 1 < list.length ? at("Следующая фраза", "Next phrase", "Келесі") : at("К проверке", "Quiz", "Тексеру")}
                  <ArrowRight size={18} />
                </button>
              </>
            )}
            {step === "quiz" && (
              <>
                <h2>{at("Что сказали?", "What was said?", "Не айтылды?")}</h2>
                <div className="vocab-choices">
                  {choices.map((c) => (
                    <button
                      key={c.ru}
                      className={picked ? (c.ru === cur.ru ? "right" : c.ru === picked ? "wrong" : "") : ""}
                      onClick={() => {
                        if (picked) return;
                        setPicked(c.ru);
                        mark(c.ru === cur.ru);
                      }}
                    >
                      {c.ru}
                    </button>
                  ))}
                </div>
                {picked && (
                  <>
                    <p className={`vocab-feedback ${picked === cur.ru ? "ok" : "no"}`} role="status">
                      {picked === cur.ru ? <Check size={18} /> : <X size={18} />}
                      {picked === cur.ru ? at("Верно!", "Correct!", "Дұрыс!") : `«${cur.ru}»`}
                    </p>
                    <button className="button primary" onClick={next}>{at("Дальше", "Next", "Әрі қарай")}<ArrowRight size={18} /></button>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      )}
      {step === "order" && cur && (
        <section className="panel phrase-order">
          <h2>{at("Соберите фразу на РЖЯ", "Build the phrase in RSL", "РЖЯ-да құрастырыңыз")}</h2>
          <OrderTask key={cur.ru} ru={cur.ru} answer={cur.signs} why={cur.tip} onResult={(ok) => { mark(ok); setAnswered(true); }} />
          {answered && <button className="button primary" onClick={next}>{at("Дальше", "Next", "Әрі қарай")}<ArrowRight size={18} /></button>}
        </section>
      )}
      {step === "done" && (
        <section className="panel vocab-done">
          <GraduationCap size={36} />
          <h2>{at("Готово!", "Done!", "Дайын!")} {score.right} / {score.total}</h2>
          <div className="vocab-nav">
            <button className="button secondary" onClick={onExit}>{at("К темам", "Topics", "Тақырыптар")}</button>
            {onNext && <button className="button primary" onClick={onNext}>{at("Следующий урок", "Next lesson", "Келесі сабақ")}<ArrowRight size={18} /></button>}
          </div>
        </section>
      )}
    </div>
  );
}
