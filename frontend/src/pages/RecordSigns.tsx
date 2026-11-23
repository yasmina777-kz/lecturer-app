import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Square, Download, Trash2, Shuffle, Upload } from "lucide-react";
import { useLiveLetters } from "../sign/useLiveLetters";
import type { Landmark } from "../sign/phraseCapture";
import { SignSequencePlayer } from "../components/SignSequencePlayer";
import { learningDictionary, normalizeSignText, type DictionaryEntry } from "../sign/dictionary";
import type { MotionAsset, MotionPlan } from "../sign/motion";
import { withVideoAssets } from "../sign/videoAssets";
import { loadWordModel } from "../sign/wordRecognizer";
import { courseUnits } from "../sign/courseUnits";
import { deleteTake, frameRow, listTakes, saveTake, type Take } from "../sign/signRecordings";
import "./avatar-review.css";
import "./record-signs.css";
import "../components/word-practice.css";

/** Collect our own training data: a signer shows each word several times;
 * only hand and body landmarks are kept (no video), in this browser, until
 * exported. More different signers = better recognition for everyone. */
const GOAL = 5;
const PRE_MS = 300, GONE_MS = 600, MAX_MS = 6000, MIN_HAND_MS = 400;
const PROFILE = "rsl-record-profile-v1";

type Frame = { now: number; row: ReturnType<typeof frameRow>; hand: boolean };

export function RecordSignsPage() {
  const [labels, setLabels] = useState<string[]>([]);
  const [assets, setAssets] = useState<MotionAsset[]>([]);
  const [words, setWords] = useState<DictionaryEntry[]>([]);
  const [takes, setTakes] = useState<Take[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(PROFILE) ?? "") as { participant: string; region: string; consent: boolean };
    } catch {
      return { participant: "", region: "", consent: false };
    }
  });
  const [active, setActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const buffer = useRef<Frame[]>([]);
  const take = useRef<{ start: number; lastHand: number; handMs: number } | null>(null);

  useEffect(() => {
    Promise.all([
      loadWordModel(),
      fetch("/avatars/sign-motion/catalog.json").then((r) => r.json()),
      fetch("/research/rsl/words/catalog.json").then((r) => r.json()),
      listTakes(),
    ])
      .then(([model, m, w, saved]) => {
        // Course words first, in lesson order: those are what learners practise.
        const known = new Map(model.labels.filter((l) => l !== "__none__").map((l) => [normalizeSignText(l), l]));
        const course: string[] = [];
        for (const u of courseUnits("all"))
          for (const w of u.words) {
            const l = known.get(normalizeSignText(w));
            if (l && !course.includes(l)) course.push(l);
          }
        const rest = [...known.values()].filter((l) => !course.includes(l)).sort((a, b) => a.localeCompare(b, "ru"));
        const list = [...course, ...rest];
        setLabels(list);
        setAssets(m);
        setWords(w);
        setTakes(saved);
      })
      .catch(() => setError("Не удалось загрузить список жестов. Обновите страницу."));
    return () => stream.current?.getTracks().forEach((t) => t.stop());
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(PROFILE, JSON.stringify(profile));
    } catch {
      /* session only */
    }
  }, [profile]);

  const count = useMemo(() => {
    const c = new Map<string, number>();
    for (const t of takes) if (t.participant === profile.participant) c.set(t.label, (c.get(t.label) ?? 0) + 1);
    return c;
  }, [takes, profile.participant]);
  const next = () => {
    const todo = labels.filter((l) => (count.get(l) ?? 0) < GOAL && l !== current);
    if (todo.length) setCurrent(todo[0]);
  };
  useEffect(() => {
    if (!current && labels.length) next();
  }, [labels]); // eslint-disable-line react-hooks/exhaustive-deps

  const plan: MotionPlan | null = useMemo(() => {
    if (!current) return null;
    const entries = learningDictionary(words, assets);
    const entry = entries.find((e) => normalizeSignText(e.label) === normalizeSignText(current));
    const asset = entry && withVideoAssets(assets, entries).find((a) => a.id === entry.id);
    return asset ? { steps: [{ ...asset, text: current }], missing: [], spelling: false } : null;
  }, [current, words, assets]);

  const ready = profile.consent && profile.participant.trim().length > 0;
  const tracking = (now: number, hands: Landmark[][], pose: Landmark[]) => {
    if (!current || !video.current) return;
    const hand = hands.some((h) => h.length === 21);
    const frame = { now, row: frameRow(hands, pose), hand };
    const buf = buffer.current;
    buf.push(frame);
    let t = take.current;
    if (!t) {
      while (buf.length && now - buf[0].now > PRE_MS) buf.shift();
      if (!hand) return;
      t = take.current = { start: now, lastHand: now, handMs: 0 };
      setRecording(true);
    }
    const prev = buf[buf.length - 2];
    if (hand) {
      if (prev?.hand) t.handMs += now - prev.now;
      t.lastHand = now;
    }
    if (now - t.lastHand < GONE_MS && now - t.start < MAX_MS) return;
    const frames = buf.splice(0);
    take.current = null;
    setRecording(false);
    if (t.handMs < MIN_HAND_MS) return; // a hand only flickered into view
    const t0 = frames[0].now;
    const saved: Take = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: current,
      participant: profile.participant.trim(),
      ...(profile.region.trim() ? { region: profile.region.trim() } : {}),
      createdAt: new Date().toISOString(),
      width: video.current.videoWidth,
      height: video.current.videoHeight,
      t: frames.map((f) => Math.round(f.now - t0)),
      hands: frames.map((f) => f.row.hands),
      pose: frames.map((f) => f.row.pose),
    };
    void saveTake(saved).then(() => {
      setTakes((list) => [...list, saved]);
      const n = (count.get(current) ?? 0) + 1;
      setFlash(n >= GOAL ? `«${current}» записано ${n} раз — переходим к следующему слову` : `Повтор ${n} из ${GOAL} сохранён`);
      if (n >= GOAL) setTimeout(next, 1200);
    });
  };
  const letters = useLiveLetters(video, overlay, active, tracking, "balanced", undefined, 33);

  async function start() {
    setError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      buffer.current = [];
      take.current = null;
      setActive(true);
    } catch (e) {
      setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Доступ к камере запрещён." : "Камера недоступна.");
    }
  }
  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setActive(false);
    setRecording(false);
  }
  async function undo() {
    const mine = takes.filter((t) => t.label === current && t.participant === profile.participant.trim());
    const last = mine[mine.length - 1];
    if (!last) return;
    await deleteTake(last.id);
    setTakes((list) => list.filter((t) => t.id !== last.id));
    setFlash("Последний повтор удалён");
  }
  function exportAll() {
    const file = new Blob([JSON.stringify({ format: "rsl-takes-v1", exportedAt: new Date().toISOString(), takes })], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = `rsl-recordings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function importFile(f?: File) {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const known = new Set(takes.map((t) => t.id));
      const fresh = (data.takes as Take[]).filter((t) => t && t.id && !known.has(t.id) && Array.isArray(t.hands));
      for (const t of fresh) await saveTake(t);
      setTakes((list) => [...list, ...fresh]);
      setFlash(`Добавлено записей: ${fresh.length}`);
    } catch {
      setError("Это не файл с записями.");
    }
  }

  const done = labels.filter((l) => (count.get(l) ?? 0) >= GOAL).length;
  const shown = labels.filter((l) => !search || l.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru"))).slice(0, 300);
  const n = count.get(current) ?? 0;
  return (
    <div className="sign-workspace avatar-review record-signs">
      <header className="ar-head">
        <div>
          <p className="ar-eyebrow">Помощь проекту</p>
          <h1>Запись жестов для обучения</h1>
          <p className="ar-lead">
            Покажите жест перед камерой {GOAL} раз: поднимите руки, покажите, опустите. Каждый повтор сохраняется сам. Видео не
            записывается и никуда не отправляется — сохраняются только точки рук и плеч. Чем больше разных людей запишут жесты, тем
            лучше платформа будет понимать всех.
          </p>
        </div>
        <div className="ar-progress">
          <b>{takes.filter((t) => t.participant === profile.participant.trim()).length}</b>
          <span>повторов записано</span>
          <div className="ar-bar">
            <i className="ok" style={{ width: `${(done / Math.max(1, labels.length)) * 100}%` }} />
          </div>
          <small>
            слов готово: {done} из {labels.length || "…"}
          </small>
        </div>
      </header>

      {!ready && (
        <section className="ar-card rs-consent">
          <h2>Перед началом</h2>
          <label>
            Имя или псевдоним участника
            <input
              className="ar-search"
              value={profile.participant}
              placeholder="например: Участник 3"
              onChange={(e) => setProfile({ ...profile, participant: e.target.value })}
            />
          </label>
          <label>
            Регион (необязательно)
            <input
              className="ar-search"
              value={profile.region}
              placeholder="например: СКО, Петропавловск"
              onChange={(e) => setProfile({ ...profile, region: e.target.value })}
            />
          </label>
          <label className="rs-check">
            <input type="checkbox" checked={profile.consent} onChange={(e) => setProfile({ ...profile, consent: e.target.checked })} />
            Я согласен(на), что записи движений моих рук и плеч (без видео и без лица) будут использованы для обучения распознавания
            жестов на платформе AI Mentor. Я могу удалить свои записи в любой момент.
          </label>
        </section>
      )}

      {error && <p className="translate-status error">{error}</p>}

      {ready && (
        <div className="ar-layout">
          <aside className="ar-list ar-card">
            <input className="ar-search" placeholder="Найти слово…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <ul>
              {shown.map((l) => (
                <li key={l}>
                  <button aria-current={l === current} onClick={() => setCurrent(l)}>
                    <span>{l}</span>
                    <small className="rs-count">{count.get(l) ?? 0}/{GOAL}</small>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <section className="ar-main ar-card">
            <div className="ar-title">
              <h2>{current || "…"}</h2>
              <button className="ar-nav" onClick={next} aria-label="Другое слово" title="Другое слово">
                <Shuffle size={16} />
              </button>
            </div>
            <div className="rs-dots" aria-label={`Повторов: ${n} из ${GOAL}`}>
              {Array.from({ length: GOAL }, (_, i) => (
                <i key={i} className={i < n ? "on" : ""} />
              ))}
            </div>
            <div className="ar-compare">
              <figure>
                <figcaption>Как показывают (образец)</figcaption>
                {plan ? <SignSequencePlayer key={current} plan={plan} only="video" /> : <p className="ar-empty">Видео-образца нет</p>}
              </figure>
              <figure>
                <figcaption>Вы {recording && <b className="rs-rec">● запись</b>}</figcaption>
                <div className="word-practice-view rs-camera" hidden={!active}>
                  <video ref={video} playsInline muted />
                  <canvas ref={overlay} aria-hidden="true" />
                </div>
                {!active && (
                  <button className="ar-btn rs-start" onClick={start}>
                    <Camera size={18} /> Включить камеру
                  </button>
                )}
                {active && !letters.ready && <p className="ar-empty">{letters.status}</p>}
              </figure>
            </div>
            <p className="rs-hint">
              Если в вашем регионе жест показывают иначе — показывайте так, как привыкли вы. Это тоже ценно.
            </p>
            {flash && <p className="translate-status" role="status">{flash}</p>}
            <div className="ar-actions rs-actions">
              {active && (
                <button className="ar-btn" onClick={stop}>
                  <Square size={18} /> Выключить камеру
                </button>
              )}
              <button className="ar-btn wrong" onClick={undo} disabled={!n}>
                <Trash2 size={18} /> Удалить последний повтор
              </button>
              <button className="ar-btn ok" onClick={next}>
                Следующее слово
              </button>
            </div>
          </section>
        </div>
      )}

      <footer className="ar-foot ar-card">
        <p>Записи хранятся в этом браузере. Когда закончите, нажмите «Скачать записи» и отправьте файл автору платформы.</p>
        <div>
          <label className="ar-file">
            <Upload size={16} /> Загрузить файл
            <input type="file" accept="application/json" onChange={(e) => importFile(e.target.files?.[0])} />
          </label>
          <button className="ar-download" onClick={exportAll} disabled={!takes.length}>
            <Download size={16} /> Скачать записи
          </button>
        </div>
      </footer>
    </div>
  );
}
