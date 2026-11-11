import { useEffect, useRef, useState } from "react";
import { Camera, Square, Upload, RefreshCw, Copy } from "lucide-react";
import { PhraseCapture, type Landmark } from "../sign/phraseCapture";
import { useLiveLetters } from "../sign/useLiveLetters";
import { at } from "../i18n/automation";
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
  const letters = useLiveLetters(
    video,
    overlay,
    phase === "recording",
    (now: number, hands: Landmark[][], pose: Landmark[]) => {
      if (recorder.current?.state !== "recording") return;
      const decision = segment.current.sample(now, hands, pose);
      setCaptureStatus(decision);
      if (decision === "signing") hasMotion.current = true;
      if (decision === "pause" || decision === "limit")
        finishCapture.current?.(true);
      if (decision === "empty") finishCapture.current?.(false);
    },
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
    const timeout = setTimeout(() => controller.abort(), 10000);
    setChecking(true);
    setMessage(
      at("Проверяем модель…", "Checking model…", "Модель тексерілуде…"),
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
        at(
          "Сервис фраз недоступен. Распознавание букв можно использовать отдельно.",
          "Phrase service is unavailable. Letter recognition is still available.",
          "Сөйлемдерді тану қызметі қолжетімсіз. Әріптерді тануды қолдана аласыз.",
        ),
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
        setText((previous) =>
          [previous, next.text].filter(Boolean).join("\n").slice(0, 4000),
        );
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
          : "Фразы пока недоступны. Готовность модели букв показана ниже.",
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
          <p>
            {at(
              "Держите лицо, плечи, локти и обе кисти в кадре.",
              "Keep your face, shoulders and both hands visible.",
              "Бет, иық, шынтақ пен екі қол кадрда толық көрінсін.",
            )}
          </p>
          <p className="recognition-privacy">
            {at(
              "Буквы распознаются на устройстве. Если сервис фраз подключён, видео фраз отправляется ему для обработки. Звук не записывается.",
              "Letters are recognized on your device. When the phrase service is connected, phrase video is sent to it for processing. Audio is not recorded.",
              "Әріптер құрылғыда танылады. Сөйлем қызметі қосылса, сөйлем бейнесі оған өңдеуге жіберіледі. Дыбыс жазылмайды.",
            )}
          </p>
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
          {phase === "recording" && health?.ready && (
            <button
              className="button secondary"
              disabled={waitingForSlot || elapsed < 1}
              onClick={() => finishCapture.current?.(true)}
            >
              Фраза закончена — распознать
            </button>
          )}
          {!health?.ready && (
            <button
              className="button secondary"
              onClick={check}
              disabled={checking}
            >
              <RefreshCw size={16} />
              {at(
                "Проверить подключение",
                "Retry connection",
                "Қосылымды тексеру",
              )}
            </button>
          )}
          <div className="recognition-live-status">
            <div>
              <strong>Тело и руки</strong>
              <span>
                {letters.bodyStatus}. Кисти — зелёные и жёлтые точки, тело —
                голубые.
              </span>
            </div>
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
              <strong>{at("Фразы", "Phrases", "Сөйлемдер")}</strong>
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
                    : at(
                        "Сервис не подключён",
                        "Service offline",
                        "Қызмет қосылмаған",
                      )}
              </span>
            </div>
          </div>
          <p role="status" aria-live="polite" className="krsl-status">
            {message}
          </p>
          {result && (
            <p className="recognition-privacy">
              {at(
                "Ориентиры найдены в кадрах:",
                "Frames with landmarks:",
                "Бағдарлар анықталған кадрлар:",
              )}{" "}
              левая кисть{" "}
              {Math.round(
                (result.tracking.leftHand ?? result.tracking.hands) * 100,
              )}
              % · правая кисть{" "}
              {Math.round(
                (result.tracking.rightHand ?? result.tracking.hands) * 100,
              )}
              % · {at("тело", "body", "дене")}{" "}
              {Math.round(result.tracking.body * 100)}% ·{" "}
              {at("лицо", "face", "бет")}{" "}
              {Math.round(result.tracking.face * 100)}%.{" "}
              {at(
                "Это качество видимости, не точность перевода.",
                "This measures visibility, not translation accuracy.",
                "Бұл аударма дәлдігі емес, көріну сапасы.",
              )}
            </p>
          )}
        </section>
        <aside className="panel recognition-captions">
          <div className="recognition-caption-heading">
            <h2>{at("Субтитры", "Captions", "Субтитрлер")}</h2>
            <span>{at("Черновик ИИ", "AI draft", "ЖИ нобайы")}</span>
          </div>
          <p>
            {at(
              "Проверьте черновик. Неясные буквы не добавляются; распознавание фраз пока экспериментальное.",
              "Review the draft. Uncertain letters are not added; phrase recognition is experimental.",
              "Әр көрсетілім жаңа жолға жазылады. Нәтижені тексеріп, қателерді түзетіңіз.",
            )}
          </p>
          <label htmlFor="live-letter-text">
            {at("Буквы", "Letters", "Әріптер")}
            {letters.last && ` · ${letters.last}`}
          </label>
          <textarea
            id="live-letter-text"
            rows={2}
            value={letters.text}
            maxLength={2000}
            onChange={(e) => letters.setText(e.target.value)}
            placeholder={at(
              "Покажите букву целиком…",
              "Show a complete letter…",
              "Әріпті толық көрсетіңіз…",
            )}
          />
          <div className="recognition-edit-tools">
            <button
              className="button secondary"
              disabled={!letters.text}
              onClick={() => letters.setText((v) => (v + " ").slice(0, 2000))}
            >
              {at("Пробел", "Space", "Бос орын")}
            </button>
            <button
              className="button secondary"
              disabled={!letters.text}
              onClick={() => letters.setText((v) => v.slice(0, -1))}
            >
              {at("Стереть букву", "Delete letter", "Әріпті өшіру")}
            </button>
            <button
              className="button secondary"
              disabled={!letters.text}
              onClick={() => {
                setText((v) => (v + "\n" + letters.text).trim().slice(0, 4000));
                letters.setText("");
              }}
            >
              {at("Добавить в текст ↓", "Add to text ↓", "Мәтінге қосу ↓")}
            </button>
          </div>
          <label htmlFor="krsl-text">
            {at("Фразы — черновик", "Phrases — draft", "Сөйлемдер — нобай")}
          </label>
          {!health?.ready && (
            <p role="status">
              {health === null
                ? at(
                    "Проверяем доступность фраз…",
                    "Checking phrase service…",
                    "Сөйлемдерді тану тексерілуде…",
                  )
                : at(
                    "Распознавание фраз недоступно: сервис не подключён. Сейчас камера распознаёт только буквы.",
                    "Phrase recognition is unavailable: the service is offline. The camera currently recognizes letters only.",
                    "Сөйлемдерді тану қолжетімсіз: қызмет қосылмаған. Камера қазір тек әріптерді таниды.",
                  )}
            </p>
          )}
          <textarea
            id="krsl-text"
            rows={8}
            maxLength={4000}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              !health?.ready
                ? at(
                    "Можно добавить распознанные буквы или ввести текст вручную",
                    "Add recognized letters or enter text manually",
                    "Танылған әріптерді қосыңыз немесе мәтінді енгізіңіз",
                  )
                : at(
                    "Здесь появятся слова из вашего видео…",
                    "Words from your video will appear here…",
                    "Бейнедегі сөздер осында шығады…",
                  )
            }
          />
          <div className="recognition-edit-tools">
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
          <details>
            <summary>
              {at(
                "Что умеет эта модель",
                "Model capabilities",
                "Модель мүмкіндіктері",
              )}
            </summary>
            <p>
              {at(
                `Видео обрабатывается сервисом распознавания и удаляется после обработки. Звук не записывается. Лимит файла: 20 секунд и ${MAX_CLIP_MB} МБ.`,
                `Video is processed by the recognition service and deleted afterwards. No audio is recorded. File limit: 20 seconds and ${MAX_CLIP_MB} MB.`,
                `Бейне тану қызметінде өңделіп, кейін жойылады. Дыбыс жазылмайды. Файл шегі: 20 секунд және ${MAX_CLIP_MB} МБ.`,
              )}
            </p>
            <p>
              {at(
                "Фразы читает сервер по ориентирам обеих рук, плеч, локтей, бровей и рта. Буквы проверяются одновременно отдельными моделями. Пауза завершает запись; длинный показ ограничен 12 секундами. Для более длинной фразы загрузите видео до 20 секунд. Голубые точки тела помогают расположиться в кадре; они не означают, что фраза распознана.",
                "The server reads both hands, shoulders, elbows, brows and mouth. Letters are checked concurrently. A pause ends capture, with a 12-second maximum. Upload a video up to 20 seconds for a longer phrase. Blue body landmarks are framing feedback, not a recognized phrase.",
                "Сервер екі қол, иық, шынтақ, қас пен ауыз бағдарларын оқиды. Әріптер қатар тексеріледі. Үзіліс жазбаны аяқтайды, шегі 12 секунд. Ұзақ сөйлем үшін 20 секундқа дейінгі бейнені жүктеңіз.",
              )}
            </p>
            <p>
              {at(
                "В отчёте автора WER около 60%: ошибок много. Это исследовательский режим, а не точный переводчик.",
                "The author reports about 60% WER: errors are frequent. This is a research mode, not an accurate translator.",
                "Автор есебінде WER шамамен 60%: қате көп. Бұл дәл аудармашы емес, зерттеу режимі.",
              )}
            </p>
            <a
              href="https://huggingface.co/dastan-issenov/krsl-cslr-checkpoints"
              target="_blank"
              rel="noreferrer"
            >
              {at(
                "Модель и отчёт автора",
                "Model and author report",
                "Модель және автор есебі",
              )}
            </a>
          </details>
        </aside>
      </div>
    </>
  );
}
