import { useEffect, useRef, useState } from "react";
import { Camera, Square, Upload, RefreshCw, Copy } from "lucide-react";
import { PhraseCapture, type Landmark } from "../sign/phraseCapture";
import { useLiveLetters } from "../sign/useLiveLetters";
import { at } from "../i18n/automation";
import type { HandPoint } from "../sign/wordFeatures";
import { loadWordModel, recognizeWord, WordSegmenter, type WordModel } from "../sign/wordRecognizer";
import { appendTranslation, replaceLastWord, WordSpotter } from "../sign/wordSpotter";
import { composePhrase, replaceTail } from "../sign/phraseComposer";
import {
  parseRecognitionHealth,
  parseRecognitionResult,
  readRecognitionResponse,
  RecognitionServiceError,
  type RecognitionHealth as Health,
  type RecognitionResult as Result,
} from "../sign/recognitionApi";

const MAX_CLIP_BYTES = import.meta.env.PROD
  ? 4 * 1024 * 1024
  : 25 * 1024 * 1024;
const MAX_CLIP_MB = import.meta.env.PROD ? 4 : 25;

function appendPhraseToTranscript(text: string, phrase: string) {
  const clean = phrase.trim();
  if (!clean) return text;
  return `${text}${text ? "\n" : ""}Черновик фразы: ${clean}`.slice(0, 4000);
}

export function ContinuousSignCamera() {
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(false);
  const healthRequest = useRef<AbortController | null>(null);
  const healthRef = useRef(health);
  healthRef.current = health;
  const [phase, setPhase] = useState<
    "idle" | "starting" | "recording" | "processing"
  >("idle");
  const [message, setMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [captureStatus, setCaptureStatus] = useState("waiting");
  const [waitingForSlot, setWaitingForSlot] = useState(false);
  const segment = useRef(new PhraseCapture());
  const hasMotion = useRef(false);
  const finishCapture = useRef<(send: boolean) => void>();
  const [processing, setProcessing] = useState(false);

  const inFlight = useRef(false);
  const pending = useRef<{ blob: Blob; id: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [text, setText] = useState("");
  const [hasPreview, setHasPreview] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const wordModel = useRef<WordModel | null>(null);
  const spotter = useRef(new WordSpotter());
  const segmenter = useRef(new WordSegmenter(600));
  const lastSpotted = useRef({ label: "", at: -Infinity });
  const [wordStatus, setWordStatus] = useState("");
  const [mode, setMode] = useState<"auto" | "words" | "letters">("auto");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Translator bookkeeping: join consecutive fingerspelled letters into one
  // word; mute letters right after/while a word sign is being recognized.
  const lastToken = useRef<{ kind: "word" | "letter"; at: number }>({ kind: "word", at: 0 });
  const lastWordAt = useRef(-Infinity);
  useEffect(() => {
    loadWordModel().then(
      (m) => (wordModel.current = m),
      () => setWordStatus("Модель слов не загрузилась — распознаются только буквы."),
    );
  }, []);
  const recentWords = useRef<{ label: string; at: number }[]>([]);
  // Last recognized word and the model's next guesses, offered as one-tap fixes.
  const [fix, setFix] = useState<{ label: string; alternatives: string[] } | null>(null);
  const addToken = (token: string, kind: "word" | "letter") => {
    const now = performance.now();
    const join = kind === "letter" && lastToken.current.kind === "letter" && now - lastToken.current.at < 4000;
    lastToken.current = { kind, at: now };
    if (kind === "letter") recentWords.current = [];
    else recentWords.current = [...recentWords.current, { label: token, at: now }].slice(-4);
    const phrase = kind === "word" ? composePhrase(recentWords.current, now) : null;
    setText((current) => {
      const next = appendTranslation(current, token, kind, join);
      return phrase ? replaceTail(next, phrase.words, phrase.text) : next;
    });
    if (phrase) {
      recentWords.current = [];
      setWordStatus(`Фраза: «${phrase.text}» (из жестов ${phrase.words.join(" + ")})`);
    }
  };
  const letters = useLiveLetters(
    video,
    overlay,
    phase === "recording",
    (now: number, hands: Landmark[][], pose: Landmark[]) => {
      // Continuous local word spotting (browser only, no pauses needed).
      const model = wordModel.current, v = video.current;
      if (model && v && !hasPreview && modeRef.current !== "letters") {
        const points = hands.filter((h) => h.length === 21).map((h) =>
          h.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })),
        ) as HandPoint[][];
        const spotted = spotter.current.push(model.members[0], now, points, v.videoWidth, v.videoHeight, model.members);
        if (spotted && !(spotted.fingerspelling && modeRef.current === "auto")) {
          lastWordAt.current = now;
          addToken(spotted.label, "word");
          setFix({ label: spotted.label, alternatives: spotted.alternatives });
          setWordStatus(`Жест «${spotted.label}» · ${Math.round(spotted.confidence * 100)}%`);
        }
        // A short pause closes the sign: classify the whole clip with the
        // 3-model ensemble (more accurate) unless the spotter already added it.
        const clip = segmenter.current.push(now, points);
        if (spotted) lastSpotted.current = { label: spotted.label, at: now };
        if (clip) {
          const guess = recognizeWord(model, clip, v.videoWidth, v.videoHeight);
          const duplicate = guess && lastSpotted.current.label === guess.label && now - lastSpotted.current.at < 4000;
          if (guess?.accepted && !duplicate) {
            lastWordAt.current = now;
            lastSpotted.current = { label: guess.label, at: now };
            addToken(guess.label, "word");
            setFix({ label: guess.label, alternatives: guess.top.slice(1, 4).map((t) => t.label) });
            setWordStatus(`Жест «${guess.label}» · ${Math.round(guess.confidence * 100)}%`);
          } else if (guess && !guess.accepted && !duplicate)
            setWordStatus(`Жест неясен. Возможно: ${guess.top.slice(0, 3).map((t) => t.label).join(", ")}`);
        }
      }
      if (recorder.current?.state !== "recording") return;
      const decision = segment.current.sample(now, hands, pose);
      setCaptureStatus(decision);
      if (decision === "signing") hasMotion.current = true;
      if (decision === "pause" || decision === "limit")
        finishCapture.current?.(true);
      if (decision === "empty") finishCapture.current?.(false);
    },
    "balanced",
    (label) => {
      if (modeRef.current === "words") return;
      if (modeRef.current === "auto" && (spotter.current.busy || spotter.current.moving(performance.now()) || performance.now() - lastWordAt.current < 1200)) return;
      if (/^[А-ЯЁ]$/u.test(label)) addToken(label, "letter");
    },
    50,
  );
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const ticker = useRef<ReturnType<typeof setInterval>>();
  const request = useRef<AbortController | null>(null);
  const preview = useRef("");
  const alive = useRef(true);

  async function check() {
    healthRequest.current?.abort();
    const controller = new AbortController();
    healthRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    setChecking(true);
    setMessage(
      at(
        "",
        "Connecting to the phrase model. First startup may take up to a minute…",
        "Сөйлем моделіне қосылудамыз. Алғашқы іске қосылу бір минутқа дейін созылуы мүмкін…",
      ),
    );
    try {
      const response = await fetch("/api/krsl/status", {
        signal: controller.signal,
      });
      const data = await readRecognitionResponse(
        response,
        parseRecognitionHealth,
      );
      if (!alive.current || healthRequest.current !== controller) return;
      healthRef.current = data;
      setHealth(data);
      if (data.ready && stream.current) record(generation.current);
      setMessage(
        data.ready
          ? ""
          : data.error || "Модель ещё загружается. Повторите проверку.",
      );
    } catch {
      if (!alive.current || healthRequest.current !== controller) return;
      healthRef.current = { ready: false, vocabulary: 0 };
      setHealth({ ready: false, vocabulary: 0 });
      setMessage(
        "",
      );
    } finally {
      clearTimeout(timeout);
      if (alive.current && healthRequest.current === controller)
        setChecking(false);
    }
  }
  function release() {
    generation.current++;
    clearTimeout(timer.current);
    clearInterval(ticker.current);
    request.current?.abort();
    pending.current = null;
    finishCapture.current = undefined;
    inFlight.current = false;
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }
  function stop() {
    release();
    setPhase("idle");
    setProcessing(false);
    setWaitingForSlot(false);
    setMessage(
      at(
        "Камера выключена. Текст сохранён на этой странице.",
        "Camera stopped. Text remains on this page.",
        "Камера өшірілді. Мәтін осы бетте сақталды.",
      ),
    );
  }
  useEffect(() => {
    alive.current = true;
    void check();
    return () => {
      alive.current = false;
      healthRequest.current?.abort();
      healthRequest.current = null;
      release();
      if (preview.current) URL.revokeObjectURL(preview.current);
    };
  }, []);

  async function recognize(blob: Blob, id: number) {
    if (!alive.current || id !== generation.current) return;
    if (blob.size > MAX_CLIP_BYTES) {
      setMessage(
        at(
          `Видео больше ${MAX_CLIP_MB} МБ. Сократите запись или выберите качество ниже.`,
          `Video exceeds ${MAX_CLIP_MB} MB. Shorten it or choose lower quality.`,
          `Бейне ${MAX_CLIP_MB} МБ-тан үлкен. Қысқартыңыз немесе сапасын төмендетіңіз.`,
        ),
      );
      return;
    }
    if (inFlight.current) {
      // Recording pauses when this slot is occupied; never replace a phrase.
      pending.current = { blob, id };
      setWaitingForSlot(true);
      return;
    }
    inFlight.current = true;
    setProcessing(true);
    setMessage(
      at(
        "Читаем движения рук, тела и лица…",
        "Reading hands, body and face…",
        "Қол, дене және бет қимылдары талдануда…",
      ),
    );
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch("/api/krsl/recognize", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "video/mp4",
          "X-KRSL-Client": "platform",
        },
        body: blob,
        signal: controller.signal,
      });
      const next = await readRecognitionResponse(
        response,
        parseRecognitionResult,
      );
      if (id !== generation.current || !alive.current) return;
      setResult(next);
      setMessage(next.message);
      if (next.status === "draft")
        setText((previous) => appendPhraseToTranscript(previous, next.text));
    } catch (error) {
      if (id !== generation.current || !alive.current) return;
      if (error instanceof RecognitionServiceError && error.status === 503) {
        healthRef.current = {
          ready: false,
          vocabulary: 0,
          error: error.message,
        };
        setHealth(healthRef.current);
        pending.current = null;
        setWaitingForSlot(false);
        finishCapture.current?.(false);
      }
      setMessage(
        error instanceof Error && error.name !== "AbortError"
          ? error.message
          : "Обработка заняла слишком долго. Попробуйте более короткое видео.",
      );
    } finally {
      clearTimeout(timeout);
      if (id === generation.current) {
        inFlight.current = false;
        setProcessing(false);
        const next = pending.current;
        pending.current = null;
        if (next) void recognize(next.blob, next.id);
        if (stream.current && recorder.current === null) {
          setWaitingForSlot(false);
          record(id);
        }
      }
    }
  }
  function record(id: number) {
    if (
      !stream.current ||
      !healthRef.current?.ready ||
      !window.MediaRecorder ||
      id !== generation.current ||
      recorder.current !== null
    )
      return;
    const mime = ["video/webm;codecs=vp8", "video/mp4", "video/webm"].find(
      (value) => MediaRecorder.isTypeSupported(value),
    );
    const parts: Blob[] = [];
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(
        stream.current,
        mime ? { mimeType: mime, videoBitsPerSecond: 1500000 } : undefined,
      );
    } catch {
      setMessage(
        "Запись фраз не поддерживается этим браузером. Буквы можно проверять отдельно.",
      );
      return;
    }
    recorder.current = rec;
    let submit = false;
    finishCapture.current = (send) => {
      if (rec.state !== "recording") return;
      submit = send;
      clearTimeout(timer.current);
      rec.stop();
    };
    rec.ondataavailable = (event) => {
      if (event.data.size) parts.push(event.data);
    };
    rec.onerror = () => {
      if (id === generation.current) {
        stop();
        setMessage("Не удалось записать видео. Попробуйте загрузить файл.");
      }
    };
    rec.onstop = async () => {
      if (id !== generation.current) return;
      recorder.current = null;
      finishCapture.current = undefined;
      clearInterval(ticker.current);
      if (healthRef.current?.ready && submit && parts.length)
        void recognize(new Blob(parts, { type: rec.mimeType }), id);
      if (id === generation.current && stream.current && !pending.current)
        record(id);
    };
    setPhase("recording");
    setElapsed(0);
    setCaptureStatus("waiting");
    hasMotion.current = false;
    segment.current.reset(performance.now());
    const started = Date.now();
    ticker.current = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      250,
    );
    try {
      rec.start();
    } catch {
      clearInterval(ticker.current);
      recorder.current = null;
      finishCapture.current = undefined;
      setMessage(
        "Не удалось начать запись фразы. Буквы можно проверять отдельно.",
      );
      return;
    }
    // Bounded memory/upload duration even if tracking fails or the tab stalls.
    timer.current = setTimeout(
      () => finishCapture.current?.(hasMotion.current),
      12000,
    );
  }
  async function start() {
    release();
    setProcessing(false);
    const id = generation.current;
    setPhase("starting");
    setResult(null);
    setHasPreview(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Этот браузер не поддерживает запись. Загрузите видео с устройства.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: false,
      });
      if (id !== generation.current || !alive.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      media.getVideoTracks()[0].onended = stop;
      if (video.current) {
        video.current.removeAttribute("src");
        video.current.srcObject = media;
        await video.current.play();
      }
      if (id !== generation.current || !alive.current) return;
      setWaitingForSlot(false);
      setMessage(
        healthRef.current?.ready
          ? ""
          : "",
      );
      setPhase("recording");
      if (healthRef.current?.ready && window.MediaRecorder) record(id);
    } catch (error) {
      if (id !== generation.current || !alive.current) return;
      release();
      setPhase("idle");
      setMessage(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Доступ к камере запрещён. Разрешите его в браузере или загрузите видео."
          : error instanceof Error
            ? error.message
            : "Камера недоступна.",
      );
    }
  }
  async function upload(file?: File) {
    if (!file || !healthRef.current?.ready) return;
    if (
      !file.size ||
      file.size > MAX_CLIP_BYTES ||
      !["video/mp4", "video/webm", "video/quicktime", "video/ogg"].includes(
        file.type,
      )
    ) {
      setMessage(
        `Выберите непустое видео MP4, WebM, MOV или OGG до ${MAX_CLIP_MB} МБ и 20 секунд.`,
      );
      return;
    }
    release();
    setResult(null);
    const id = generation.current;
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = URL.createObjectURL(file);
    setHasPreview(true);
    setPhase("processing");
    if (video.current) {
      video.current.src = preview.current;
      video.current.controls = true;
    }
    await recognize(file, id);
    if (id === generation.current) setPhase("idle");
  }
  const active = phase !== "idle";
  return (
    <>
      <div className="recognition-layout">
        <section className="panel krsl-camera">
          <h2>{at("Камера", "Camera", "Камера")}</h2>
          <div className="recognition-edit-tools">
            <button
              className="button primary"
              onClick={start}
              disabled={active}
            >
              <Camera size={18} />
              {at("Включить камеру", "Start camera", "Камераны қосу")}
            </button>
            <button
              className="button secondary"
              onClick={stop}
              disabled={!active}
            >
              <Square size={18} />
              {at("Остановить", "Stop", "Тоқтату")}
            </button>
            <label className="button secondary krsl-upload">
              <Upload size={18} />
              {at("Загрузить видео", "Upload video", "Бейне жүктеу")}
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/ogg"
                disabled={active || !health?.ready}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void upload(file);
                }}
              />
            </label>
          </div>
          <div className="krsl-view">
            {!stream.current && !hasPreview && (
              <div className="krsl-placeholder">
                <Camera size={42} />
                <strong>
                  {at(
                    "Камера пока выключена",
                    "Camera is off",
                    "Камера өшірулі",
                  )}
                </strong>
                <span>
                  {at(
                    "Покажите лицо и руки целиком",
                    "Keep your face and hands in frame",
                    "Бет пен қол толық көрінсін",
                  )}
                </span>
              </div>
            )}
            <video
              hidden={!stream.current && !hasPreview}
              ref={video}
              playsInline
              muted
              controls={hasPreview && phase === "idle"}
              className={stream.current ? "krsl-mirror" : ""}
            />
            <canvas
              ref={overlay}
              className="unified-hand-overlay krsl-mirror"
              aria-hidden="true"
            />
            {phase === "recording" && health?.ready && (
              <span className="krsl-capture-badge">
                {waitingForSlot
                  ? "Подождите — обрабатываем фразы"
                  : captureStatus === "waiting"
                    ? "Ожидаем движение"
                    : `Записываем фразу · ${elapsed} с`}
              </span>
            )}
            {phase === "starting" && <span className="krsl-countdown">…</span>}
          </div>
          {phase === "recording" && letters.ready && (
            <div className="recognition-edit-tools">
              <button
                className="button secondary"
                onClick={
                  letters.capturing ? letters.finishLetter : letters.startLetter
                }
              >
                {letters.capturing
                  ? at(
                      "Буква показана — распознать",
                      "Letter complete — recognize",
                      "Әріп көрсетілді — тану",
                    )
                  : at(
                      "Записать отдельную букву",
                      "Capture one letter",
                      "Бір әріпті жазу",
                    )}
              </button>
              <span role="status">
                {letters.capturing
                  ? at(
                      "Покажите букву целиком и нажмите ещё раз. Максимум 10 секунд.",
                      "Show the full letter, then press again. Maximum 10 seconds.",
                      "Әріпті толық көрсетіп, қайта басыңыз. Ең көбі 10 секунд.",
                    )
                  : at(
                      "Если быстрый жест пропускается, запишите его отдельно.",
                      "Capture a fast sign separately if it is skipped.",
                      "Жылдам ым танылмаса, оны бөлек жазыңыз.",
                    )}
              </span>
            </div>
          )}
          {phase === "recording" && health?.ready && (
            <button
              className="button secondary"
              disabled={waitingForSlot || elapsed < 1}
              onClick={() => finishCapture.current?.(true)}
            >
              Фраза закончена — распознать
            </button>
          )}
          <div className="recognition-live-status">
            <div>
              <strong>{at("Буквы", "Letters", "Әріптер")}</strong>
              <span>{letters.status}</span>
              {letters.failed && (
                <button className="button secondary" onClick={letters.retry}>
                  {at(
                    "Загрузить модель букв снова",
                    "Retry letter model",
                    "Әріп моделін қайта жүктеу",
                  )}
                </button>
              )}
              {phase === "recording" && (
                <progress
                  value={letters.progress}
                  max={100}
                  aria-label="Сбор движения буквы"
                />
              )}
            </div>
            <div>
              <strong>{at("Слова", "Words", "Сөздер")}</strong>
              <span>
                {processing
                  ? at(
                      waitingForSlot
                        ? "Очередь заполнена. Подождите перед следующей фразой — записанные фразы не пропускаются."
                        : "Распознаём предыдущую фразу. Можно показать следующую.",
                      "Processing the previous clip… Camera is still running.",
                      "Алдыңғы үзінді өңделуде… Камера жұмыс істеп тұр.",
                    )
                  : health?.ready
                    ? at(
                        "Запись завершается после паузы · максимум 12 секунд",
                        "Finish after a pause · maximum 12 seconds",
                        "Үзілістен кейін аяқталады · ең көбі 12 секунд",
                      )
                    : wordStatus || "—"}
              </span>
            </div>
          </div>
          <p role="status" aria-live="polite" className="krsl-status">
            {message}
          </p>
        </section>
        <aside className="panel recognition-captions">
          <div className="recognition-caption-heading">
            <h2>{at("Субтитры", "Captions", "Субтитрлер")}</h2>
            <span>{at("Черновик ИИ", "AI draft", "ЖИ нобайы")}</span>
          </div>
          <label htmlFor="krsl-text" className="sr-only">
            {at(
              "Результат камеры · буквы и фразы",
              "Camera output · letters and phrases",
              "Камера нәтижесі · әріптер мен сөйлемдер",
            )}
          </label>
          <p className="translator-tip">
            {at(
              "Показывайте жесты подряд. Букву держите 2 секунды.",
              "Sign continuously — a short pause improves accuracy. Hold a letter for about 2 seconds.",
              "Ымдарды қатарынан көрсетіңіз — қысқа үзіліс дәлдікті арттырады. Әріпті 2 секундтай ұстаңыз.",
            )}
          </p>
          <div className="translator-mode" role="group" aria-label={at("Что распознавать", "What to recognize", "Не тану керек")}>
            {([
              ["auto", at("Авто", "Auto", "Авто")],
              ["words", at("Слова", "Words", "Сөздер")],
              ["letters", at("Буквы", "Letters", "Әріптер")],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}>
                {label}
              </button>
            ))}
          </div>
          <textarea
            id="krsl-text"
            rows={10}
            maxLength={4000}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              !health?.ready
                ? at(
                    "Покажите букву или фразу; распознанные результаты будут добавляться сюда",
                    "Show a letter or phrase; recognized results will appear here",
                    "Әріп не сөйлем көрсетіңіз — танылған нәтиже осында қосылады",
                  )
                : at(
                    "Результаты букв и фраз появятся здесь…",
                    "Letter and phrase results will appear here…",
                    "Әріп пен сөйлем нәтижелері осында шығады…",
                  )
            }
          />
          {fix && fix.alternatives.length > 0 && text && (
            <div className="translator-fix" role="group" aria-label={at("Исправить последнее слово", "Fix the last word", "Соңғы сөзді түзету")}>
              <span>{at("Не то?", "Wrong?", "Қате ме?")}</span>
              {fix.alternatives.map((alt) => (
                <button
                  key={alt}
                  type="button"
                  onClick={() => {
                    setText((t) => replaceLastWord(t, fix.label, alt));
                    setFix(null);
                  }}
                >
                  {alt.replace(/[!?.]$/u, "")}
                </button>
              ))}
            </div>
          )}
          <div className="recognition-edit-tools">
            <button
              className="button secondary"
              disabled={!text}
              onClick={() => setText((value) => (value + " ").slice(0, 4000))}
            >
              {at("Пробел", "Space", "Бос орын")}
            </button>
            <button
              className="button secondary"
              disabled={!text}
              onClick={() => setText((value) => value.slice(0, -1))}
            >
              {at("Стереть символ", "Delete character", "Таңбаны өшіру")}
            </button>
            <button
              className="button secondary"
              disabled={!text}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  setMessage(
                    at("Текст скопирован.", "Text copied.", "Мәтін көшірілді."),
                  );
                } catch {
                  setMessage(
                    at(
                      "Выделите текст и скопируйте вручную.",
                      "Select and copy the text manually.",
                      "Мәтінді белгілеп, қолмен көшіріңіз.",
                    ),
                  );
                }
              }}
            >
              <Copy size={16} />
              {at("Копировать", "Copy", "Көшіру")}
            </button>
            <button
              className="button secondary"
              disabled={!text}
              onClick={() => setText("")}
            >
              {at("Очистить", "Clear", "Тазалау")}
            </button>
          </div>
          {text.length >= 4000 && (
            <p role="status">
              {at(
                "Лимит 4000 символов. Скопируйте и очистите текст.",
                "4,000 character limit. Copy and clear the text.",
                "4000 таңба шегі. Мәтінді көшіріп, тазалаңыз.",
              )}
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
