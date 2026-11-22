import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { at } from "../i18n/automation";
import { SignChain } from "../components/SignChain";
import { GRAMMAR, PHRASES, type PhraseItem } from "../sign/course";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./fingerspell.css";

/** Watch a whole phrase signed by native signers (real dictionary videos, RSL
 * word order) and choose its meaning. Distractors share signs with the answer,
 * so one recognised word is not enough. */
const KEY = "rsl-phrase-understanding-v1";
function pool(): PhraseItem[] {
  const seen = new Set<string>();
  const items = [
    ...PHRASES,
    ...GRAMMAR.filter((l) => l.track !== "kzhr").flatMap((l) => l.examples.filter((e) => !/ — (РЖЯ|КЖР)$/.test(e.ru))),
  ];
  return items.filter((p) => p.signs.length >= 2 && !p.gloss && !seen.has(p.ru) && seen.add(p.ru));
}
function shuffle<T>(a: T[]) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
export function optionsFor(answer: PhraseItem, all: PhraseItem[]) {
  const others = all.filter((p) => p.ru !== answer.ru);
  const overlap = (p: PhraseItem) => p.signs.filter((s) => answer.signs.includes(s)).length;
  const close = shuffle(others.filter((p) => overlap(p) > 0)).sort((a, b) => overlap(b) - overlap(a));
  const picked = [...close.slice(0, 3)];
  for (const p of shuffle(others)) if (picked.length < 3 && !picked.includes(p)) picked.push(p);
  return shuffle([answer, ...picked]);
}

export function PhraseUnderstandingPage() {
  const all = useMemo(pool, []);
  const [round, setRound] = useState(() => shuffle(all).slice(0, 8));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [replay, setReplay] = useState(0);
  const item = round[i];
  const options = useMemo(() => (item ? optionsFor(item, all) : []), [item, all]);
  const done = i >= round.length;
  function choose(ru: string) {
    if (picked) return;
    setPicked(ru);
    if (ru === item.ru) setScore((s) => s + 1);
  }
  function next() {
    setI((n) => n + 1);
    setPicked(null);
    if (i + 1 >= round.length) {
      try {
        const best = JSON.parse(localStorage.getItem(KEY) ?? "0") || 0;
        localStorage.setItem(KEY, JSON.stringify(Math.max(best, score)));
      } catch {
        /* private mode */
      }
    }
  }
  return (
    <div className="sign-workspace fingerspell phrase-understanding">
      <Link className="text-link back-link" to="/understanding">
        <ArrowLeft size={16} /> {at("Понимание жестов", "Understanding", "Ымдарды түсіну")}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{at("СМОТРЕТЬ И ПОНИМАТЬ", "WATCH AND UNDERSTAND", "ҚАРАУ ЖӘНЕ ТҮСІНУ")}</span>
          <h1>{at("Понимание фраз", "Understanding phrases", "Сөйлемдерді түсіну")}</h1>
          <p>
            {at(
              "Носители показывают фразу целиком в порядке РЖЯ. Выберите, что она значит.",
              "Signers show a whole phrase in RSL order. Choose its meaning.",
              "Тұтас сөйлем көрсетіледі. Мағынасын таңдаңыз.",
            )}
          </p>
        </div>
      </div>
      {done ? (
        <section className="panel fs-done">
          <h2>{at("Готово!", "Done!", "Дайын!")}</h2>
          <p className="fs-score">
            {score} / {round.length}
          </p>
          <div className="fs-actions">
            <button className="button primary" onClick={() => { setRound(shuffle(all).slice(0, 8)); setI(0); setScore(0); }}>
              {at("Ещё 8 фраз", "8 more phrases", "Тағы 8 сөйлем")}
            </button>
            <Link className="button secondary" to="/grammar">{at("Грамматика", "Grammar", "Грамматика")}</Link>
          </div>
        </section>
      ) : (
        <div className="fs-round">
          <section className={`panel fs-player${picked ? "" : " hide-answer"}`}>
            <SignChain key={`${item.ru}-${replay}`} signs={item.signs} compact />
            <button className="button secondary" onClick={() => setReplay((r) => r + 1)}>{at("Показать ещё раз", "Show again", "Қайта көрсету")}</button>
          </section>
          <section className="panel fs-answer">
            <span className="eyebrow">{i + 1} / {round.length} · {at("счёт", "score", "ұпай")} {score}</span>
            <h2>{at("Что сказали?", "What was said?", "Не айтылды?")}</h2>
            <div className="vocab-choices">
              {options.map((o) => (
                <button key={o.ru} className={!picked ? "" : o.ru === item.ru ? "right" : o.ru === picked ? "wrong" : ""} onClick={() => choose(o.ru)}>
                  {o.ru}
                </button>
              ))}
            </div>
            {picked && (
              <>
                <p className={`vocab-feedback ${picked === item.ru ? "ok" : "no"}`} role="status">
                  {picked === item.ru ? <Check size={18} /> : <X size={18} />}
                  {at("Жесты", "Signs", "Ымдар")}: {item.signs.map((s) => s.replace(/[!?]$/, "").toUpperCase()).join(" · ")}
                </p>
                {item.tip && <p className="fs-tip">{item.tip}</p>}
                <button className="button primary" onClick={next}>
                  {at("Дальше", "Next", "Келесі")} <ArrowRight size={16} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
      <p className="fs-credit">
        {at(
          "Фразы составлены по правилам РЖЯ из видео словаря (разные носители). Это упражнение на понимание, а не сертифицированный перевод.",
          "Phrases are built from dictionary videos in RSL order; not a certified translation.",
          "Сөйлемдер сөздік бейнелерінен құрастырылған.",
        )}
      </p>
    </div>
  );
}
