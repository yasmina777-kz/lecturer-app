import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Download, RotateCcw, Square, X, Video } from "lucide-react";
import { useLiveLetters } from "../sign/useLiveLetters";
import type { Landmark } from "../sign/phraseCapture";
import type { HandPoint } from "../sign/wordFeatures";
import { judgeWord, loadWordModel, recognizeWord, WordSegmenter, type WordModel } from "../sign/wordRecognizer";
import { alphabet } from "../sign/exercises";
import type { DictionaryEntry } from "../sign/dictionary";
import "./sign-workspace.css";
import "./native-check.css";

/** Session tool for testing the platform with a native RSL signer:
 * accuracy of the camera AI on real webcams, signer review of reference
 * videos, and consented recording of signs the datasets lack. Everything
 * stays in this browser until exported as a file. */
type Tab = "accuracy" | "videos" | "record";
const store = {
  read<T>(key: string, fallback: T): T {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  },
  write(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode */
    }
  },
};
function download(name: string, data: unknown) {
  const blob = data instanceof Blob ? data : new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

function useCamera() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [on, setOn] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    setError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      setOn(true);
    } catch {
      setError("Камера недоступна или доступ запрещён.");
    }
  }
  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setOn(false);
  }
  useEffect(() => stop, []);
  return { video, stream, on, error, start, stop };
}

export function NativeCheckPage() {
  const [tab, setTab] = useState<Tab>("accuracy");
  const [words, setWords] = useState<DictionaryEntry[]>([]);
  useEffect(() => {
    fetch("/research/rsl/words/catalog.json").then((r) => r.json()).then(setWords).catch(() => {});
  }, []);
  return (
    <div className="sign-workspace native-check">
      <div className="page-heading">
        <div>
          <h1>Проверка с носителем языка</h1>
          <p>Результаты сохраняются в этом браузере. В конце нажмите «Скачать результаты».</p>
        </div>
      </div>
      <div className="native-tabs" role="tablist">
        {([
          ["accuracy", "1. Точность ИИ"],
          ["videos", "2. Оценка видео"],
          ["record", "3. Запись жестов"],
        ] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "accuracy" && <AccuracyTab words={words} />}
      {tab === "videos" && <VideosTab words={words} />}
      {tab === "record" && <RecordTab />}
    </div>
  );
}

type Result = {
  target: string;
  kind: "letter" | "word";
  predicted: string[];
  confidence: number;
  auto: "correct" | "close" | "wrong" | "unclear";
  manual?: "ai-right" | "ai-wrong" | "sign-wrong";
  at: string;
  landmarks?: number[][][][];
};
const RESULTS = "ai-mentor:native-check:results:v1";

function AccuracyTab({ words }: { words: DictionaryEntry[] }) {
  const cam = useCamera();
  const overlay = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<WordModel | null>(null);
  const [kind, setKind] = useState<"letters" | "words" | "mixed">("mixed");
  const [items, setItems] = useState<{ label: string; kind: "letter" | "word" }[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>(() => store.read(RESULTS, []));
  const [current, setCurrent] = useState<Result | null>(null);
  const [armed, setArmed] = useState(false);
  const [saveLandmarks, setSaveLandmarks] = useState(true);
  const segmenter = useRef(new WordSegmenter(700));
  const item = items[index];
  const itemRef = useRef(item);
  itemRef.current = item;
  const armedRef = useRef(armed);
  armedRef.current = armed;
  useEffect(() => {
    loadWordModel().then(setModel, () => {});
  }, []);
  useEffect(() => store.write(RESULTS, results), [results]);

  const letters = useLiveLetters(
    cam.video,
    overlay,
    cam.on,
    (now: number, hands: Landmark[][]) => {
      const it = itemRef.current;
      if (!armedRef.current || !it || it.kind !== "word" || !model || !cam.video.current) return;
      const points = hands.filter((h) => h.length === 21).map((h) => h.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }))) as HandPoint[][];
      const clip = segmenter.current.push(now, points);
      if (!clip) return;
      const v = cam.video.current;
      const guess = recognizeWord(model, clip, v.videoWidth, v.videoHeight);
      const { verdict } = judgeWord(guess, it.label);
      setArmed(false);
      setCurrent({
        target: it.label,
        kind: "word",
        predicted: guess?.top.slice(0, 3).map((t) => t.label) ?? [],
        confidence: guess?.confidence ?? 0,
        auto: verdict === "different" ? "wrong" : verdict,
        at: new Date().toISOString(),
        landmarks: saveLandmarks
          ? clip.map((frame) => frame.map((hand) => hand.map((p) => [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)])))
          : undefined,
      });
    },
    "balanced",
    undefined,
    50,
    (prediction) => {
      const it = itemRef.current;
      if (!it || it.kind !== "letter") return;
      setArmed(false);
      setCurrent({
        target: it.label,
        kind: "letter",
        predicted: prediction ? [prediction.label] : [],
        confidence: prediction?.confidence ?? 0,
        auto: !prediction ? "unclear" : prediction.accepted && prediction.label === it.label ? "correct" : prediction.label === it.label ? "close" : "wrong",
        at: new Date().toISOString(),
      });
    },
  );

  function newSet() {
    const L = shuffle(alphabet).slice(0, kind === "letters" ? 15 : 8).map((label) => ({ label, kind: "letter" as const }));
    const W = shuffle(words).slice(0, kind === "words" ? 20 : 12).map((w) => ({ label: w.label, kind: "word" as const }));
    setItems(kind === "letters" ? L : kind === "words" ? W : shuffle([...L, ...W]));
    setIndex(0);
    setCurrent(null);
  }
  function attempt() {
    setCurrent(null);
    if (!item) return;
    if (item.kind === "letter") {
      letters.startLetter();
      setArmed(true);
    } else {
      segmenter.current.reset();
      setArmed(true);
    }
  }
  function save(manual?: Result["manual"]) {
    if (!current) return;
    setResults((r) => [...r, { ...current, manual }]);
    setCurrent(null);
    setIndex((i) => i + 1);
  }
  const stats = useMemo(() => {
    const ok = (r: Result) => (r.manual ? r.manual === "ai-right" : r.auto === "correct");
    const valid = results.filter((r) => r.manual !== "sign-wrong");
    const by = (k: Result["kind"]) => valid.filter((r) => r.kind === k);
    const pct = (a: Result[]) => (a.length ? Math.round((100 * a.filter(ok).length) / a.length) : 0);
    const top3 = by("word").filter((r) => r.predicted.includes(r.target)).length;
    return { letters: by("letter"), words: by("word"), pct, top3 };
  }, [results]);
  const exp = item?.kind === "word" ? words.find((w) => w.label === item.label) : undefined;

  return (
    <div className="native-grid">
      <section className="panel">
        <div className="native-camera">
          <video ref={cam.video} playsInline muted />
          <canvas ref={overlay} aria-hidden="true" />
          {!cam.on && <span className="native-placeholder">Камера выключена</span>}
          {armed && <span className="native-rec">{item?.kind === "letter" ? "Покажите букву и нажмите «Готово»" : "Покажите жест и опустите руки"}</span>}
        </div>
        <div className="native-actions">
          {!cam.on ? (
            <button className="button primary" onClick={cam.start}><Camera size={18} />Включить камеру</button>
          ) : (
            <button className="button secondary" onClick={cam.stop}><Square size={18} />Выключить</button>
          )}
          {cam.error && <span className="native-error">{cam.error}</span>}
        </div>
        <p className="native-muted">{cam.on ? letters.status : "Посадите носителя так, чтобы были видны голова, плечи и руки."}</p>
      </section>
      <section className="panel native-task">
        {!items.length || index >= items.length ? (
          <>
            <h2>{items.length ? "Набор завершён" : "Новый набор"}</h2>
            <div className="native-seg">
              {([["mixed", "Буквы + слова"], ["letters", "Только буквы"], ["words", "Только слова"]] as const).map(([id, label]) => (
                <button key={id} aria-pressed={kind === id} onClick={() => setKind(id)}>{label}</button>
              ))}
            </div>
            <label className="native-check-row">
              <input type="checkbox" checked={saveLandmarks} onChange={(e) => setSaveLandmarks(e.target.checked)} />
              Сохранять точки рук (без видео) для дообучения ИИ — с согласия носителя
            </label>
            <button className="button primary" disabled={!words.length} onClick={newSet}>Начать набор</button>
          </>
        ) : (
          <>
            <span className="native-muted">{index + 1} / {items.length} · {item.kind === "letter" ? "буква" : "слово"}</span>
            <h2 className="native-target">{item.label}</h2>
            {exp && (
              <details>
                <summary>Образец</summary>
                <video className="native-ref" src={exp.displayVideo ?? exp.video} autoPlay loop muted playsInline />
              </details>
            )}
            {!current ? (
              <div className="native-actions">
                {!armed ? (
                  <button className="button primary" disabled={!cam.on || (item.kind === "word" && !model)} onClick={attempt}>Показать жест</button>
                ) : item.kind === "letter" ? (
                  <button className="button primary" onClick={letters.finishLetter}>Готово</button>
                ) : (
                  <button className="button secondary" onClick={() => setArmed(false)}>Отмена</button>
                )}
                <button className="button secondary" onClick={() => setIndex(index + 1)}>Пропустить</button>
              </div>
            ) : (
              <>
                <div className={`native-verdict is-${current.auto}`}>
                  <strong>{current.auto === "correct" ? "ИИ узнал верно" : current.auto === "close" ? "ИИ почти узнал" : current.auto === "unclear" ? "ИИ не уверен" : "ИИ ошибся"}</strong>
                  <span>Ответ ИИ: {current.predicted.join(", ") || "—"} ({Math.round(current.confidence * 100)}%)</span>
                </div>
                <div className="native-actions">
                  <button className="button primary" onClick={() => save()}><Check size={18} />Сохранить и дальше</button>
                  <button className="button secondary" onClick={() => save("ai-right")}>ИИ прав</button>
                  <button className="button secondary" onClick={() => save("ai-wrong")}>ИИ ошибся</button>
                  <button className="button secondary" onClick={() => save("sign-wrong")}>Жест показан неверно</button>
                  <button className="button secondary" onClick={attempt}><RotateCcw size={18} />Повторить</button>
                </div>
              </>
            )}
          </>
        )}
        <div className="native-stats">
          <div><strong>{stats.pct(stats.letters)}%</strong><span>буквы верно ({stats.letters.length})</span></div>
          <div><strong>{stats.pct(stats.words)}%</strong><span>слова верно ({stats.words.length})</span></div>
          <div><strong>{stats.words.length ? Math.round((100 * stats.top3) / stats.words.length) : 0}%</strong><span>слово в топ-3</span></div>
        </div>
        <div className="native-actions">
          <button className="button secondary" disabled={!results.length} onClick={() => download(`ai-mentor-accuracy-${stamp()}.json`, results)}><Download size={18} />Скачать результаты</button>
          <button className="button secondary" disabled={!results.length} onClick={() => confirm("Удалить все результаты проверки точности?") && setResults([])}><X size={18} />Очистить</button>
        </div>
      </section>
    </div>
  );
}

const REVIEWS = "ai-mentor:native-check:reviews:v1";
type Review = { label: string; video: string; verdict: "ok" | "inexact" | "wrong"; comment: string };
function VideosTab({ words }: { words: DictionaryEntry[] }) {
  const [reviews, setReviews] = useState<Record<string, Review>>(() => store.read(REVIEWS, {}));
  const [topic, setTopic] = useState("Алфавит");
  const [comment, setComment] = useState("");
  useEffect(() => store.write(REVIEWS, reviews), [reviews]);
  const letters = alphabet.map((l) => ({ label: l, video: `/research/rsl/alphabet/${l.codePointAt(0)!.toString(16).padStart(4, "0")}.mp4?v=2` }));
  const topics = ["Алфавит", ...Array.from(new Set(words.map((w) => w.category)))];
  const list = topic === "Алфавит" ? letters : words.filter((w) => w.category === topic).map((w) => ({ label: w.label, video: w.displayVideo ?? w.video }));
  const next = list.find((x) => !reviews[x.video]);
  const done = list.filter((x) => reviews[x.video]).length;
  function mark(verdict: Review["verdict"]) {
    if (!next) return;
    setReviews((r) => ({ ...r, [next.video]: { label: next.label, video: next.video, verdict, comment } }));
    setComment("");
  }
  return (
    <section className="panel native-videos">
      <div className="native-seg">
        <select value={topic} onChange={(e) => setTopic(e.target.value)}>
          {topics.map((t) => <option key={t}>{t}</option>)}
        </select>
        <span className="native-muted">Проверено {done} из {list.length} · всего отметок {Object.keys(reviews).length}</span>
      </div>
      {next ? (
        <div className="native-review">
          <video key={next.video} src={next.video} autoPlay loop muted playsInline controls />
          <div>
            <h2 className="native-target">{next.label}</h2>
            <p>Жест на видео показан правильно?</p>
            <div className="native-actions">
              <button className="button primary" onClick={() => mark("ok")}><Check size={18} />Верно</button>
              <button className="button secondary" onClick={() => mark("inexact")}>Неточно</button>
              <button className="button secondary" onClick={() => mark("wrong")}><X size={18} />Неверно</button>
            </div>
            <input className="native-input" placeholder="Комментарий (необязательно)" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
      ) : (
        <p>В этой теме всё проверено. Выберите другую тему.</p>
      )}
      <div className="native-actions">
        <button className="button secondary" disabled={!Object.keys(reviews).length} onClick={() => download(`ai-mentor-video-review-${stamp()}.json`, Object.values(reviews))}><Download size={18} />Скачать оценки</button>
      </div>
    </section>
  );
}

const MISSING = ["Спасибо", "Пожалуйста", "Извините", "Где?", "Врач", "Сейчас", "Устал", "Как дела?", "До свидания", "Как тебя зовут?", "Меня зовут…", "Я не понимаю", "Повторите, пожалуйста", "Помогите"];
function RecordTab() {
  const cam = useCamera();
  const [consent, setConsent] = useState(false);
  const [person, setPerson] = useState("signer-01");
  const [custom, setCustom] = useState("");
  const [recording, setRecording] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [saved, setSaved] = useState<string[]>(() => store.read("ai-mentor:native-check:recorded:v1", []));
  const rec = useRef<MediaRecorder | null>(null);
  useEffect(() => store.write("ai-mentor:native-check:recorded:v1", saved), [saved]);
  async function record(label: string) {
    if (!cam.stream.current || !consent) return;
    for (let i = 3; i > 0; i--) {
      setCount(i);
      await new Promise((r) => setTimeout(r, 700));
    }
    setCount(0);
    const mime = ["video/webm;codecs=vp9", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
    const parts: Blob[] = [];
    const r = new MediaRecorder(cam.stream.current, mime ? { mimeType: mime } : undefined);
    rec.current = r;
    r.ondataavailable = (e) => e.data.size && parts.push(e.data);
    r.onstop = () => {
      const ext = (r.mimeType || "").includes("mp4") ? "mp4" : "webm";
      const slug = label.toLocaleLowerCase("ru").replace(/[^а-яёa-z0-9]+/giu, "-").replace(/^-|-$/g, "");
      const name = `${person}_${slug}_${stamp()}.${ext}`;
      download(name, new Blob(parts, { type: r.mimeType }));
      setSaved((s) => [...s, name]);
      setRecording(null);
    };
    setRecording(label);
    r.start();
    setTimeout(() => r.state === "recording" && r.stop(), 6000);
  }
  return (
    <div className="native-grid">
      <section className="panel">
        <div className="native-camera">
          <video ref={cam.video} playsInline muted />
          {!cam.on && <span className="native-placeholder">Камера выключена</span>}
          {count > 0 && <span className="native-count">{count}</span>}
          {recording && <span className="native-rec">Запись: {recording}</span>}
        </div>
        <div className="native-actions">
          {!cam.on ? (
            <button className="button primary" onClick={cam.start}><Camera size={18} />Включить камеру</button>
          ) : (
            <>
              <button className="button secondary" onClick={cam.stop}><Square size={18} />Выключить</button>
              {recording && <button className="button primary" onClick={() => rec.current?.stop()}>Остановить запись</button>}
            </>
          )}
        </div>
      </section>
      <section className="panel native-task">
        <label className="native-check-row">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          Носитель согласен, что запись будет использована для обучения ИИ (видео сохраняется только на этот компьютер)
        </label>
        <input className="native-input" value={person} onChange={(e) => setPerson(e.target.value.replace(/[^\w-]/g, ""))} aria-label="Код участника" />
        <p className="native-muted">Каждая запись — 6 секунд после отсчёта 3-2-1. Файл скачивается автоматически.</p>
        <div className="native-chips">
          {MISSING.map((m) => (
            <button key={m} disabled={!cam.on || !consent || !!recording} onClick={() => record(m)}>
              <Video size={15} />{m} {saved.filter((s) => s.includes(m.toLocaleLowerCase("ru").replace(/[^а-яёa-z0-9]+/giu, "-").replace(/^-|-$/g, ""))).length || ""}
            </button>
          ))}
        </div>
        <div className="native-actions">
          <input className="native-input" placeholder="Другой жест или фраза" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button className="button secondary" disabled={!cam.on || !consent || !custom.trim() || !!recording} onClick={() => record(custom.trim())}>Записать</button>
        </div>
        <p className="native-muted">Записано файлов: {saved.length}</p>
      </section>
    </div>
  );
}
