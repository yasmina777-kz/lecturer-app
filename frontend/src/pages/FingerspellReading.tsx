import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Eye, Play, RotateCcw, X } from "lucide-react";
import { at } from "../i18n/automation";
import "./sign-workspace.css";
import "./fingerspell.css";

/** Reading fingerspelling: a real Bukva signer spells a word letter by letter
 * (each letter cut to its annotated span); the learner types what they saw. */
type Manifest = { signers: Record<string, { letters: Record<string, { file: string }> }> };
const LEVELS: { id: string; title: string; words: string[] }[] = [
  { id: "short", title: "Короткие слова", words: ["ДОМ", "КОТ", "СОК", "ЧАЙ", "ЛЕС", "НОС", "МАМА", "ПАПА", "РЫБА", "ЗИМА", "ЛУНА", "ВОДА", "МЯЧ", "СЫР", "ДЫМ", "ЛУК", "РОТ", "САД", "ЖУК", "ЁЖ", "ЮГ", "ЩИ", "ЭХО", "ШАР", "ГОД", "ФЕН", "ХЛЕБ", "ЦЕХ", "ПОЛЕ", "РЕКА"] },
  { id: "names", title: "Имена", words: ["АНЯ", "ОЛЕГ", "ИВАН", "МАША", "ДИНА", "ЮРА", "ЛЕНА", "ПЁТР", "ТИМУР", "АЙГЕРИМ", "ДАНИЯР", "АРМАН", "ЕЛЕНА", "ЗАРИНА", "ФЁДОР", "ЭМИЛЬ", "ЯНА", "БОРИС", "ЖАННА", "ХАСАН", "ЦЕЗАРЬ", "ШАМИЛЬ", "ЭЛЬВИРА", "ВИКТОР", "СОФЬЯ"] },
  { id: "cities", title: "Города", words: ["ОМСК", "УФА", "ТУЛА", "СОЧИ", "ПЕРМЬ", "КАЗАНЬ", "МОСКВА", "АЛМАТЫ", "АСТАНА", "МИНСК", "САМАРА", "ТВЕРЬ", "ЯЛТА", "ЧИТА", "КУРСК", "ВОЛГОГРАД", "НОВОСИБИРСК", "ЕКАТЕРИНБУРГ", "ХАБАРОВСК", "ШЫМКЕНТ"] },
  { id: "long", title: "Длинные слова", words: ["ШКОЛА", "КНИГА", "ДРУЖБА", "ТЕЛЕФОН", "КОМПЬЮТЕР", "УЧИТЕЛЬ", "ПЕРЕВОД", "СЕМЬЯ", "ЯЗЫК", "ЖЕСТЫ", "ПРИВЕТ", "СПАСИБО", "ПОЖАЛУЙСТА", "ЗДРАВСТВУЙТЕ", "УНИВЕРСИТЕТ", "ПРОГРАММА", "ЧАСЫ", "ЩЁТКА", "ВЬЮГА", "ПОДЪЕЗД"] },
];
const LETTERS = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
const KEY = "rsl-fingerspell-progress-v1";
const norm = (s: string) => s.toUpperCase().replace(/Ё/g, "Е").replace(/[^А-Я]/g, "");
function pick<T>(a: T[], n: number) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b.slice(0, n);
}
function readBest(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

export function FingerspellReadingPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState("");
  const [level, setLevel] = useState<string | null>(null);
  useEffect(() => {
    fetch("/research/rsl/fingerspell/manifest.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setManifest)
      .catch(() => setError(at("Не удалось загрузить видео дактиля.", "Could not load fingerspelling videos.", "Дактиль бейнелері жүктелмеді.")));
  }, []);
  const best = readBest();
  return (
    <div className="sign-workspace vocab fingerspell">
      <Link className="text-link back-link" to="/learn">
        <ArrowLeft size={16} /> {at("Учиться", "Learn", "Оқу")}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{at("ТРЕНАЖЁР", "TRAINER", "ЖАТТЫҒУ")}</span>
          <h1>{at("Чтение дактиля", "Reading fingerspelling", "Дактильді оқу")}</h1>
          <p>
            {at(
              "Носитель языка показывает слово по буквам — напишите, что вы увидели. Имена, города и новые слова в жизни показывают именно так.",
              "A signer spells a word letter by letter — type what you saw.",
              "Ым тілін білетін адам сөзді әріптермен көрсетеді — көргеніңізді жазыңыз.",
            )}
          </p>
        </div>
      </div>
      {error && <p className="translate-status error">{error}</p>}
      {!level ? (
        <div className="fs-levels">
          {LEVELS.map((l, i) => (
            <button key={l.id} className="panel fs-level" onClick={() => setLevel(l.id)} disabled={!manifest}>
              <span className="fs-num">0{i + 1}</span>
              <strong>{l.title}</strong>
              <span>
                {l.words.length} {at("слов", "words", "сөз")}
                {best[l.id] !== undefined && ` · ${at("лучший результат", "best", "үздік")}: ${best[l.id]}/10`}
              </span>
            </button>
          ))}
        </div>
      ) : (
        manifest && <Round key={level} manifest={manifest} level={LEVELS.find((l) => l.id === level)!} onExit={() => setLevel(null)} />
      )}
      <p className="fs-credit">
        {at(
          "Видео букв — датасет Bukva (ai-forever), каждая буква вырезана по разметке авторов. Скорость реального дактиля обычно выше — начните с 0.75× и ускоряйтесь.",
          "Letter videos: Bukva dataset (ai-forever), cut to the authors' annotations.",
          "Әріп бейнелері — Bukva (ai-forever).",
        )}
      </p>
    </div>
  );
}

function Round({ manifest, level, onExit }: { manifest: Manifest; level: { id: string; title: string; words: string[] }; onExit: () => void }) {
  const words = useMemo(() => pick(level.words, 10), [level]);
  const [i, setI] = useState(0);
  const [signer, setSigner] = useState(Object.keys(manifest.signers)[0]);
  const [speed, setSpeed] = useState(0.75);
  const [hint, setHint] = useState(false);
  const [answer, setAnswer] = useState("");
  const [tries, setTries] = useState(0);
  const [result, setResult] = useState<null | "ok" | "no" | "shown">(null);
  const [score, setScore] = useState(0);
  const [shownLetter, setShownLetter] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const run = useRef(0);
  const word = words[i];
  const done = i >= words.length;

  // One <video> per distinct letter of the word, preloaded, drawn onto a canvas in turn.
  async function play() {
    const id = ++run.current;
    const letters = [...word].filter((c) => LETTERS.includes(c));
    const vids = new Map<string, HTMLVideoElement>();
    await Promise.all(
      [...new Set(letters)].map(
        (c) =>
          new Promise<void>((resolve) => {
            const v = document.createElement("video");
            v.muted = true;
            v.playsInline = true;
            v.preload = "auto";
            v.src = manifest.signers[signer].letters[c].file;
            v.oncanplaythrough = () => resolve();
            v.onerror = () => resolve();
            vids.set(c, v);
            v.load();
          }),
      ),
    );
    if (id !== run.current) return;
    setPlaying(true);
    const ctx = canvas.current?.getContext("2d");
    for (let k = 0; k < letters.length; k++) {
      if (id !== run.current) return;
      setShownLetter(k);
      const v = vids.get(letters[k])!;
      v.currentTime = 0;
      v.playbackRate = speed;
      await v.play().catch(() => {});
      await new Promise<void>((resolve) => {
        const draw = () => {
          if (id !== run.current) return resolve();
          if (ctx && v.readyState >= 2) ctx.drawImage(v, 0, 0, ctx.canvas.width, ctx.canvas.height);
          if (v.ended || v.currentTime >= v.duration - 0.02) return resolve();
          requestAnimationFrame(draw);
        };
        draw();
      });
    }
    if (id === run.current) {
      setPlaying(false);
      setShownLetter(-1);
    }
  }
  useEffect(() => {
    if (!done) void play();
    return () => {
      run.current++;
    };
  }, [i, signer]);

  function check() {
    if (!answer.trim() || result) return;
    if (norm(answer) === norm(word)) {
      setResult("ok");
      setScore((s) => s + (tries === 0 ? 1 : 0.5));
    } else if (tries === 0) {
      setTries(1);
      setResult(null);
      setAnswer("");
      void play();
      setResult("no");
      setTimeout(() => setResult(null), 1600);
    } else setResult("shown");
  }
  function next() {
    setI((n) => n + 1);
    setAnswer("");
    setTries(0);
    setResult(null);
  }
  useEffect(() => {
    if (!done) return;
    const best = readBest();
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...best, [level.id]: Math.max(best[level.id] ?? 0, Math.round(score)) }));
    } catch {
      /* private mode */
    }
  }, [done]);

  if (done)
    return (
      <section className="panel fs-done">
        <h2>{at("Готово!", "Done!", "Дайын!")}</h2>
        <p className="fs-score">
          {Math.round(score)} / {words.length}
        </p>
        <p>
          {score >= 8
            ? at("Отлично! Попробуйте скорость побольше или следующий уровень.", "Great! Try a faster speed or the next level.", "Тамаша!")
            : at("Хорошее начало. Повторите азбуку в разделе «Практика» и попробуйте ещё раз.", "Good start. Review the alphabet and try again.", "Жақсы бастама.")}
        </p>
        <div className="fs-actions">
          <button className="button primary" onClick={onExit}>
            {at("К уровням", "To levels", "Деңгейлерге")}
          </button>
          <Link className="button secondary" to="/practice">
            {at("Повторить азбуку", "Review the alphabet", "Әліпбиді қайталау")}
          </Link>
        </div>
      </section>
    );
  return (
    <div className="fs-round">
      <section className="panel fs-player">
        <canvas ref={canvas} width={360} height={448} aria-label={at("Видео дактиля", "Fingerspelling video", "Дактиль бейнесі")} />
        <div className="fs-letters" aria-hidden={!hint}>
          {hint &&
            [...word].map((c, k) => (
              <span key={k} className={k === shownLetter ? "on" : k < shownLetter || shownLetter < 0 ? "past" : ""}>
                {k <= shownLetter || (shownLetter < 0 && result) ? c : "•"}
              </span>
            ))}
        </div>
        <div className="fs-controls">
          <button className="button secondary" onClick={() => void play()} disabled={playing}>
            {playing ? <Play size={16} /> : <RotateCcw size={16} />} {at("Ещё раз", "Again", "Тағы")}
          </button>
          <div className="vocab-chips" role="group" aria-label={at("Скорость", "Speed", "Жылдамдық")}>
            {[0.5, 0.75, 1, 1.25].map((v) => (
              <button key={v} aria-pressed={speed === v} onClick={() => setSpeed(v)}>
                {v}×
              </button>
            ))}
          </div>
          <button className="button secondary" aria-pressed={hint} onClick={() => setHint((h) => !h)}>
            <Eye size={16} /> {at("Показывать буквы", "Show letters", "Әріптерді көрсету")}
          </button>
          {Object.keys(manifest.signers).length > 1 && (
            <button className="button secondary" onClick={() => setSigner((s) => { const k = Object.keys(manifest.signers); return k[(k.indexOf(s) + 1) % k.length]; })}>
              {at("Другой человек", "Another signer", "Басқа адам")}
            </button>
          )}
        </div>
      </section>
      <section className="panel fs-answer">
        <span className="eyebrow">
          {level.title} · {i + 1} / {words.length}
        </span>
        <h2>{at("Что показали?", "What was spelled?", "Не көрсетілді?")}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (result === "ok" || result === "shown") next();
            else check();
          }}
        >
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={at("Напишите слово", "Type the word", "Сөзді жазыңыз")}
            autoFocus
            disabled={result === "ok" || result === "shown"}
            lang="ru"
          />
          {result === "ok" || result === "shown" ? (
            <button className="button primary" type="submit">
              {at("Дальше", "Next", "Келесі")}
            </button>
          ) : (
            <button className="button primary" type="submit" disabled={!answer.trim()}>
              {at("Проверить", "Check", "Тексеру")}
            </button>
          )}
        </form>
        {result === "ok" && (
          <p className="vocab-feedback ok" role="status">
            <Check size={18} /> {at("Верно", "Correct", "Дұрыс")}: {word}
          </p>
        )}
        {result === "no" && (
          <p className="vocab-feedback no" role="status">
            <X size={18} /> {at("Не совсем — смотрим ещё раз", "Not quite — watch again", "Толық емес — тағы қараймыз")}
          </p>
        )}
        {result === "shown" && (
          <p className="vocab-feedback no" role="status">
            <X size={18} /> {at("Правильный ответ", "Answer", "Дұрыс жауап")}: <strong>{word}</strong>
          </p>
        )}
        <p className="fs-tip">
          {at(
            "Совет: смотрите на форму кисти в момент остановки, а не на переходы между буквами.",
            "Tip: read the handshape when the hand pauses, not the transitions.",
            "Кеңес: қол тоқтаған сәттегі пішінге қараңыз.",
          )}
        </p>
        <p className="fs-progress">
          {at("Счёт", "Score", "Ұпай")}: {score} · <button className="text-link" onClick={onExit}>{at("К уровням", "To levels", "Деңгейлерге")}</button>
        </p>
      </section>
    </div>
  );
}
