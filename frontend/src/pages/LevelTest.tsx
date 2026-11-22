import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Award, Check, X } from "lucide-react";
import { at } from "../i18n/automation";
import { SignChain } from "../components/SignChain";
import { alphabetEntries, type DictionaryEntry } from "../sign/dictionary";
import { GRAMMAR, PHRASES, type GrammarTask, type PhraseItem } from "../sign/course";
import { questionOptions, shuffle } from "../sign/activities";
import { useActivityCatalog } from "../sign/useActivities";
import { optionsFor } from "./PhraseUnderstanding";
import { readTests, TEST_KEY } from "../sign/levelTests";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./fingerspell.css";

/** End-of-level test: 10 mixed tasks on real signer videos; 8/10 passes. */
type Task =
  | { kind: "letter" | "word"; entry: DictionaryEntry; options: DictionaryEntry[] }
  | { kind: "phrase"; item: PhraseItem; options: PhraseItem[] }
  | { kind: "grammar"; task: Extract<GrammarTask, { kind: "choice" }> };
const SKILL: Record<Task["kind"], { name: string; to: string; tip: string }> = {
  letter: { name: "Буквы", to: "/practice", tip: "Повторите азбуку в «Практике» и потренируйте «Чтение дактиля»." },
  word: { name: "Слова", to: "/vocab", tip: "Повторите слова в тренажёре — особенно отмеченные для повторения." },
  phrase: { name: "Фразы", to: "/understanding/phrases", tip: "Потренируйтесь в «Понимании фраз»." },
  grammar: { name: "Грамматика", to: "/grammar", tip: "Перечитайте уроки грамматики и сделайте упражнения ещё раз." },
};
function buildTasks(level: number, words: DictionaryEntry[]): Task[] {
  const letters = alphabetEntries();
  const letterTasks = (n: number) =>
    shuffle(letters).slice(0, n).map((entry) => ({ kind: "letter" as const, entry, options: shuffle([entry, ...shuffle(letters.filter((l) => l.id !== entry.id)).slice(0, 3)]) }));
  const wordTasks = (n: number) =>
    shuffle(words).slice(0, n).map((entry) => ({ kind: "word" as const, entry, options: questionOptions(entry, words) }));
  const phrases = PHRASES.filter((p) => p.signs.length >= 2 && !p.gloss);
  const phraseTasks = (n: number) => shuffle(phrases).slice(0, n).map((item) => ({ kind: "phrase" as const, item, options: optionsFor(item, phrases) }));
  const grammarTasks = (n: number) =>
    shuffle(GRAMMAR.filter((l) => l.track !== "kzhr").flatMap((l) => l.tasks.filter((t): t is Extract<GrammarTask, { kind: "choice" }> => t.kind === "choice")))
      .slice(0, n)
      .map((task) => {
        // Authored options list the right answer first: shuffle and re-point it.
        const order = shuffle(task.options.map((_, k) => k));
        return { kind: "grammar" as const, task: { ...task, options: order.map((k) => task.options[k]), correct: order.indexOf(task.correct) } };
      });
  if (level === 1) return letterTasks(10);
  if (level === 2) return shuffle([...wordTasks(7), ...letterTasks(3)]);
  return shuffle([...phraseTasks(4), ...grammarTasks(3), ...wordTasks(3)]);
}

export function LevelTestPage() {
  const [params] = useSearchParams();
  const level = Math.min(3, Math.max(1, Number(params.get("level")) || 1));
  const { data, error } = useActivityCatalog();
  const words = useMemo(() => (data?.entries ?? []).filter((e) => e.category !== "Алфавит" && (e.displayVideo || e.video)), [data]);
  const [seed, setSeed] = useState(0);
  const tasks = useMemo(() => (words.length ? buildTasks(level, words) : []), [level, words, seed]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<{ kind: Task["kind"]; ok: boolean }[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const titles = ["", at("Буквы и дактиль", "Letters", "Әріптер"), at("Первые слова", "First words", "Алғашқы сөздер"), at("Понимание и общение", "Understanding", "Түсіну")];
  if (error) return <p className="translate-status error">{error}</p>;
  if (!tasks.length) return <div className="sign-workspace">…</div>;
  const done = i >= tasks.length;
  const score = answers.filter((a) => a.ok).length;
  const t = tasks[i];
  const correctIndex = !t ? -1 : t.kind === "grammar" ? t.task.correct : t.kind === "phrase" ? t.options.indexOf(t.item) : t.options.indexOf(t.entry);
  const labels = !t ? [] : t.kind === "grammar" ? t.task.options : t.kind === "phrase" ? t.options.map((o) => o.ru) : t.options.map((o) => o.label.replace(/[!?]$/, ""));
  function choose(k: number) {
    if (picked !== null) return;
    setPicked(k);
    setAnswers((a) => [...a, { kind: t.kind, ok: k === correctIndex }]);
  }
  function next() {
    setPicked(null);
    setI((n) => n + 1);
    if (i + 1 >= tasks.length) {
      const final = answers.filter((a) => a.ok).length;
      const best = readTests();
      try {
        localStorage.setItem(TEST_KEY, JSON.stringify({ ...best, [level]: Math.max(best[level] ?? 0, final) }));
      } catch {
        /* private mode */
      }
    }
  }
  const header = (
    <>
      <Link className="text-link back-link" to={`/learn?stage=${level}`}>
        <ArrowLeft size={16} /> {titles[level]}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{at("ИТОГОВЫЙ ТЕСТ", "LEVEL TEST", "ҚОРЫТЫНДЫ ТЕСТ")} · {at("уровень", "level", "деңгей")} {level}</span>
          <h1>{titles[level]}</h1>
          <p>{at("10 заданий на видео носителей языка. Тест пройден, если 8 и больше верных ответов.", "10 tasks on native-signer videos. Pass with 8 or more.", "10 тапсырма. 8 және одан көп — өтті.")}</p>
        </div>
      </div>
    </>
  );
  if (done) {
    const passed = score >= 8;
    const weak = (Object.keys(SKILL) as Task["kind"][])
      .map((k) => ({ k, total: answers.filter((a) => a.kind === k).length, ok: answers.filter((a) => a.kind === k && a.ok).length }))
      .filter((s) => s.total);
    return (
      <div className="sign-workspace vocab fingerspell">
        {header}
        <section className="panel fs-done">
          {passed && <Award size={40} />}
          <h2>{passed ? at("Уровень пройден!", "Level passed!", "Деңгей өтті!") : at("Почти! Нужно 8 из 10", "Almost! You need 8 of 10", "Аз қалды! 10-нан 8 керек")}</h2>
          <p className="fs-score">{score} / {tasks.length}</p>
          <ul className="test-skills">
            {weak.map((s) => (
              <li key={s.k}>
                <strong>{SKILL[s.k].name}</strong>: {s.ok} / {s.total}
                {s.ok < s.total && (
                  <>
                    {" — "}
                    <Link to={SKILL[s.k].to}>{SKILL[s.k].tip}</Link>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="fs-actions">
            {passed && level < 3 ? (
              <Link className="button primary" to={`/learn?stage=${level + 1}`}>
                {at("Следующий уровень", "Next level", "Келесі деңгей")} <ArrowRight size={16} />
              </Link>
            ) : (
              <button className="button primary" onClick={() => { setSeed((s) => s + 1); setI(0); setAnswers([]); }}>
                {at("Пройти ещё раз", "Try again", "Қайта өту")}
              </button>
            )}
            <Link className="button secondary" to="/learn">{at("К обучению", "To learning", "Оқуға")}</Link>
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className="sign-workspace vocab fingerspell phrase-understanding">
      {header}
      <div className="fs-round">
        <section className={`panel fs-player${picked === null ? " hide-answer" : ""}`}>
          {t.kind === "phrase" ? (
            <SignChain key={t.item.ru} signs={t.item.signs} compact />
          ) : t.kind === "grammar" ? (
            <div className="test-grammar">{at("Вопрос по грамматике", "Grammar question", "Грамматика сұрағы")}</div>
          ) : (
            <video key={t.entry.id} className="test-video" src={t.entry.displayVideo || t.entry.video} autoPlay loop muted playsInline controls />
          )}
        </section>
        <section className="panel fs-answer">
          <span className="eyebrow">{i + 1} / {tasks.length} · {SKILL[t.kind].name}</span>
          <h2>
            {t.kind === "grammar"
              ? t.task.question
              : t.kind === "letter"
                ? at("Какая это буква?", "Which letter is it?", "Бұл қай әріп?")
                : t.kind === "word"
                  ? at("Что означает жест?", "What does the sign mean?", "Ым нені білдіреді?")
                  : at("Что сказали?", "What was said?", "Не айтылды?")}
          </h2>
          <div className="vocab-choices">
            {labels.map((l, k) => (
              <button key={k} className={picked === null ? "" : k === correctIndex ? "right" : k === picked ? "wrong" : ""} onClick={() => choose(k)}>
                {l}
              </button>
            ))}
          </div>
          {picked !== null && (
            <>
              <p className={`vocab-feedback ${picked === correctIndex ? "ok" : "no"}`} role="status">
                {picked === correctIndex ? <Check size={18} /> : <X size={18} />}
                {t.kind === "grammar" ? t.task.why : `${at("Ответ", "Answer", "Жауап")}: ${labels[correctIndex]}`}
              </p>
              <button className="button primary" onClick={next}>
                {i + 1 < tasks.length ? at("Дальше", "Next", "Келесі") : at("Результат", "Result", "Нәтиже")} <ArrowRight size={16} />
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
