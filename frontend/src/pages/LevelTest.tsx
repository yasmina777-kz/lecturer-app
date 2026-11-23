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
import { courseUnits, type CefrLevel } from "../sign/courseUnits";
import { placementLevel, readTests, savePlacement, TEST_KEY } from "../sign/levelTests";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./fingerspell.css";

/** End-of-level test: 10 mixed tasks on real signer videos; 8/10 passes. */
type Task = (
  | { kind: "letter" | "word"; entry: DictionaryEntry; options: DictionaryEntry[] }
  | { kind: "phrase"; item: PhraseItem; options: PhraseItem[] }
  | { kind: "grammar"; task: Extract<GrammarTask, { kind: "choice" }> }
) & { cefr?: "A1" | "A2" | "B1" };
/** Placement: 4 tasks per level, easiest first (A1 → A2 → B1). */
function buildPlacement(words: DictionaryEntry[]): Task[] {
  return (["A1", "A2", "B1"] as const).flatMap((c) => {
    const t = buildCefrTasks(c, words);
    // Prefer one phrase/grammar question per level so it is not words only.
    const mixed = [...t.filter((x) => x.kind !== "word").slice(0, 1), ...t.filter((x) => x.kind === "word")].slice(0, 4);
    return mixed.map((x) => ({ ...x, cefr: c }));
  });
}
const SKILL: Record<Task["kind"], { name: string; to: string; tip: string }> = {
  letter: { name: "Буквы", to: "/practice", tip: "Повторите азбуку в «Практике» и потренируйте «Чтение дактиля»." },
  word: { name: "Слова", to: "/vocab", tip: "Повторите слова в тренажёре — особенно отмеченные для повторения." },
  phrase: { name: "Фразы", to: "/understanding/phrases", tip: "Потренируйтесь в «Понимании фраз»." },
  grammar: { name: "Грамматика", to: "/grammar", tip: "Перечитайте уроки грамматики и сделайте упражнения ещё раз." },
};
/** CEFR test: words, phrases and grammar of that level's course units. */
function buildCefrTasks(cefr: CefrLevel, words: DictionaryEntry[]): Task[] {
  const units = courseUnits(cefr);
  const byLabel = new Map(words.map((w) => [w.label, w]));
  const pool = [...new Set(units.flatMap((u) => u.words))].map((l) => byLabel.get(l)).filter((e): e is DictionaryEntry => !!e);
  const wordTasks = shuffle(pool).slice(0, 6).map((entry) => {
    const others = shuffle(pool.filter((e) => e.id !== entry.id)).slice(0, 3);
    return { kind: "word" as const, entry, options: shuffle([entry, ...others]) };
  });
  const phrases = units.flatMap((u) => u.phrases).filter((p) => p.signs.length >= 2);
  const phraseTasks = shuffle(phrases).slice(0, 2).map((item) => ({ kind: "phrase" as const, item, options: optionsFor(item, phrases) }));
  const ids = new Set(units.map((u) => u.grammar).filter(Boolean));
  const grammar = shuffle(GRAMMAR.filter((l) => ids.has(l.id)).flatMap((l) => l.tasks.filter((t): t is Extract<GrammarTask, { kind: "choice" }> => t.kind === "choice")))
    .slice(0, 10 - wordTasks.length - phraseTasks.length)
    .map((task) => {
      const order = shuffle(task.options.map((_, k) => k));
      return { kind: "grammar" as const, task: { ...task, options: order.map((k) => task.options[k]), correct: order.indexOf(task.correct) } };
    });
  return shuffle([...wordTasks, ...phraseTasks, ...grammar]);
}

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
  const cefr = (["A1", "A2", "B1"] as const).find((c) => c === params.get("cefr"));
  const level = Math.min(3, Math.max(1, Number(params.get("level")) || 1));
  const placement = params.get("placement") === "1";
  const key = placement ? "placement" : cefr ? `cefr-${cefr}` : String(level);
  const { data, error } = useActivityCatalog();
  const words = useMemo(() => (data?.entries ?? []).filter((e) => e.category !== "Алфавит" && (e.displayVideo || e.video)), [data]);
  const [seed, setSeed] = useState(0);
  const tasks = useMemo(
    () => (words.length ? (placement ? buildPlacement(words) : cefr ? buildCefrTasks(cefr, words) : buildTasks(level, words)) : []),
    [level, cefr, placement, words, seed],
  );
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<{ kind: Task["kind"]; ok: boolean; cefr?: string }[]>([]);
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
    setAnswers((a) => [...a, { kind: t.kind, ok: k === correctIndex, cefr: t.cefr }]);
  }
  function next() {
    setPicked(null);
    setI((n) => n + 1);
    if (i + 1 >= tasks.length && placement) {
      const all = answers;
      const ok = (c: string) => all.filter((a) => a.cefr === c && a.ok).length;
      const per = (c: string) => all.filter((a) => a.cefr === c).length;
      savePlacement({
        level: placementLevel({ A1: ok("A1"), A2: ok("A2"), B1: ok("B1") }, 4),
        scores: Object.fromEntries(["A1", "A2", "B1"].map((c) => [c, `${ok(c)}/${per(c)}`])),
        at: new Date().toISOString(),
      });
    }
    if (i + 1 >= tasks.length && !placement) {
      const final = answers.filter((a) => a.ok).length;
      const best = readTests();
      try {
        localStorage.setItem(TEST_KEY, JSON.stringify({ ...best, [key]: Math.max(best[key] ?? 0, final) }));
      } catch {
        /* private mode */
      }
    }
  }
  const header = (
    <>
      <Link className="text-link back-link" to={cefr ? `/course?level=${cefr}` : `/learn?stage=${level}`}>
        <ArrowLeft size={16} /> {cefr ? `${at("Курс", "Course", "Курс")} ${cefr}` : titles[level]}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{placement ? at("ТЕСТ УРОВНЯ", "PLACEMENT TEST", "ДЕҢГЕЙ ТЕСТІ") : at("ИТОГОВЫЙ ТЕСТ", "LEVEL TEST", "ҚОРЫТЫНДЫ ТЕСТ")} · {placement ? "A1 → B1" : cefr ?? `${at("уровень", "level", "деңгей")} ${level}`}</span>
          <h1>{placement ? at("С какого уровня начать?", "Where should you start?", "Қай деңгейден бастау керек?") : cefr ? `${at("Уровень", "Level", "Деңгей")} ${cefr}` : titles[level]}</h1>
          <p>{placement
            ? at("12 вопросов: сначала простые, потом сложнее. Не знаете ответ — выберите любой, это нормально.", "12 questions from easy to harder. Don’t know? Just pick one.", "12 сұрақ: оңайдан қиынға.")
            : at("10 заданий на видео носителей языка. Тест пройден, если 8 и больше верных ответов.", "10 tasks on native-signer videos. Pass with 8 or more.", "10 тапсырма. 8 және одан көп — өтті.")}</p>
        </div>
      </div>
    </>
  );
  if (done && placement) {
    const ok = (c: string) => answers.filter((a) => a.cefr === c && a.ok).length;
    const start = placementLevel({ A1: ok("A1"), A2: ok("A2"), B1: ok("B1") }, 4);
    const course = start === "B2" ? "B1" : start;
    return (
      <div className="sign-workspace vocab fingerspell">
        {header}
        <section className="panel fs-done">
          <Award size={40} />
          <h2>
            {start === "A1"
              ? at("Начнём с основ — уровень A1", "Let’s start with the basics — A1", "A1 деңгейінен бастаймыз")
              : start === "B2"
                ? at("Отлично! Вы знаете материал курса", "Great! You know the course material", "Керемет!")
                : at(`Ваш уровень: ${start}`, `Your level: ${start}`, `Деңгейіңіз: ${start}`)}
          </h2>
          <ul className="test-skills">
            {(["A1", "A2", "B1"] as const).map((c) => (
              <li key={c}>
                <strong>{c}</strong>: {ok(c)} / {answers.filter((a) => a.cefr === c).length}
              </li>
            ))}
          </ul>
          <p>
            {start === "B2"
              ? at("Повторите B1 и переходите к живой практике.", "Review B1 and move on to live practice.", "B1 қайталаңыз.")
              : at("Предыдущие уровни можно открыть в любой момент.", "Earlier levels stay open any time.", "Алдыңғы деңгейлер ашық.")}
          </p>
          <div className="fs-actions">
            <Link className="button primary" to={`/course?level=${course}`}>
              {at(`Начать ${course}`, `Start ${course}`, `${course} бастау`)} <ArrowRight size={16} />
            </Link>
            {course !== "A1" && <Link className="button secondary" to="/course?level=A1">{at("Всё равно с A1", "Start from A1 anyway", "A1-ден бастау")}</Link>}
          </div>
        </section>
      </div>
    );
  }
  if (done) {
    const passed = score >= Math.ceil(tasks.length * 0.8);
    const weak = (Object.keys(SKILL) as Task["kind"][])
      .map((k) => ({ k, total: answers.filter((a) => a.kind === k).length, ok: answers.filter((a) => a.kind === k && a.ok).length }))
      .filter((s) => s.total);
    return (
      <div className="sign-workspace vocab fingerspell">
        {header}
        <section className="panel fs-done">
          {passed && <Award size={40} />}
          <h2>{passed ? at("Уровень пройден!", "Level passed!", "Деңгей өтті!") : at(`Почти! Нужно ${Math.ceil(tasks.length * 0.8)} из ${tasks.length}`, `Almost! You need ${Math.ceil(tasks.length * 0.8)} of ${tasks.length}`, `Аз қалды!`)}</h2>
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
            {passed && cefr ? (
              <Link className="button primary" to={`/course?level=${cefr === "A1" ? "A2" : cefr === "A2" ? "B1" : "B2"}`}>
                {at("Следующий уровень", "Next level", "Келесі деңгей")} <ArrowRight size={16} />
              </Link>
            ) : passed && level < 3 ? (
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
            <figure className="test-grammar">
              <img src="/illustrations/sign-phrases/phrase-14.jpg" alt="" />
              <figcaption>
                <strong>{at("Вопрос по грамматике", "Grammar question", "Грамматика сұрағы")}</strong>
                <span>{at("Видео не нужно — выберите ответ справа.", "No video needed — pick an answer on the right.", "Жауапты оң жақтан таңдаңыз.")}</span>
              </figcaption>
            </figure>
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
