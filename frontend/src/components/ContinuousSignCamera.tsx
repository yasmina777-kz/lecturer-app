import { useEffect, useRef, useState } from "react";
import { Camera, Square, Upload, RefreshCw, Copy } from "lucide-react";
import { at } from "../i18n/automation";

type Result = {
  status: "draft" | "uncertain" | "no_tracking";
  text: string;
  message: string;
  seconds: number;
  tracking: { hands: number; body: number; face: number };
};
type Health = {
  ready: boolean;
  vocabulary: number;
  error?: string;
  upstreamMetrics?: { wer?: number };
};

export function ContinuousSignCamera() {
  const [health, setHealth] = useState<Health | null>(null);
  const [phase, setPhase] = useState<
    "idle" | "starting" | "recording" | "processing"
  >("idle");
  const [message, setMessage] = useState("");
  const [remaining, setRemaining] = useState(6);
  const [result, setResult] = useState<Result | null>(null);
  const [text, setText] = useState("");
  const [hasPreview, setHasPreview] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const ticker = useRef<ReturnType<typeof setInterval>>();
  const request = useRef<AbortController | null>(null);
  const preview = useRef("");
  const alive = useRef(true);

  async function check() {
    setMessage(
      at("Проверяем модель…", "Checking model…", "Модель тексерілуде…"),
    );
    try {
      const response = await fetch("/api/krsl/status", {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error();
      const data: Health = await response.json();
      if (!alive.current) return;
      setHealth(data);
      setMessage(
        data.ready
          ? ""
          : data.error || "Модель ещё загружается. Повторите проверку.",
      );
    } catch {
      if (!alive.current) return;
      setHealth({ ready: false, vocabulary: 0 });
      setMessage(
        at(
          "Сервис распознавания не запущен. Откройте start.command в папке платформы и повторите проверку.",
          "Recognition service is offline. Open start.command in the platform folder and retry.",
          "Тану қызметі қосылмаған. Платформа қалтасындағы start.command файлын ашып, қайта тексеріңіз.",
        ),
      );
    }
  }
  function release() {
    generation.current++;
    clearTimeout(timer.current);
    clearInterval(ticker.current);
    request.current?.abort();
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }
  function stop() {
    release();
    setPhase("idle");
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
      release();
      if (preview.current) URL.revokeObjectURL(preview.current);
    };
  }, []);

  async function recognize(blob: Blob, id: number) {
    setPhase("processing");
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
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.detail || "Не удалось распознать видео.");
      if (id !== generation.current || !alive.current) return;
      const next = body as Result;
      setResult(next);
      setMessage(next.message);
      if (next.status === "draft")
        setText((previous) =>
          [previous, next.text].filter(Boolean).join("\n").slice(0, 4000),
        );
    } catch (error) {
      if (id !== generation.current || !alive.current) return;
      release();
      setPhase("idle");
      setMessage(
        error instanceof Error && error.name !== "AbortError"
          ? error.message
          : "Обработка заняла слишком долго. Попробуйте более короткое видео.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  function record(id: number) {
    if (!stream.current || id !== generation.current) return;
    const mime = ["video/webm;codecs=vp8", "video/mp4", "video/webm"].find(
      (value) => MediaRecorder.isTypeSupported(value),
    );
    const parts: Blob[] = [];
    const rec = new MediaRecorder(
      stream.current,
      mime ? { mimeType: mime, videoBitsPerSecond: 1500000 } : undefined,
    );
    recorder.current = rec;
    rec.ondataavailable = (event) => {
      if (event.data.size) parts.push(event.data);
    };
    rec.onerror = () => {
      if (id === generation.current) {
        release();
        setPhase("idle");
        setMessage("Не удалось записать видео. Попробуйте загрузить файл.");
      }
    };
    rec.onstop = async () => {
      if (id !== generation.current) return;
      clearInterval(ticker.current);
      await recognize(new Blob(parts, { type: rec.mimeType }), id);
      if (id === generation.current && stream.current) record(id);
    };
    setPhase("recording");
    setRemaining(6);
    setMessage(
      at(
        "Покажите короткую фразу. После отсчёта дождитесь ответа.",
        "Show a short phrase. Wait for the result after the countdown.",
        "Қысқа сөйлем көрсетіңіз. Санақтан кейін нәтижені күтіңіз.",
      ),
    );
    const started = Date.now();
    ticker.current = setInterval(
      () =>
        setRemaining(
          Math.max(0, 6 - Math.floor((Date.now() - started) / 1000)),
        ),
      250,
    );
    rec.start();
    timer.current = setTimeout(() => {
      if (rec.state === "recording") rec.stop();
    }, 6000);
  }
  async function start() {
    release();
    const id = generation.current;
    setPhase("starting");
    setResult(null);
    setHasPreview(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
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
      record(id);
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
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setMessage("Выберите видео до 25 МБ и 20 секунд.");
      return;
    }
    release();
    const id = generation.current;
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = URL.createObjectURL(file);
    setHasPreview(true);
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
      <div className="recognition-scope">
        <span>
          KRSL · {health?.vocabulary || "…"}{" "}
          {at("слов и меток", "vocabulary entries", "сөз бен белгі")}
        </span>
        <p>
          {at(
            "Экспериментальные субтитры для казахско-русского жестового языка. Модель выдаёт предположение о словах, может ошибаться и не восстанавливает грамматику.",
            "Experimental Kazakh–Russian Sign Language captions. Predicted words can be wrong; grammar is not reconstructed.",
            "Қазақ-орыс ым тіліне арналған тәжірибелік субтитрлер. Сөздерді қате тануы мүмкін; грамматика қалпына келтірілмейді.",
          )}
        </p>
      </div>
      <div className="recognition-layout">
        <section className="panel krsl-camera">
          <h2>{at("Покажите фразу", "Show a phrase", "Сөйлем көрсетіңіз")}</h2>
          <p>
            {at(
              "В кадре должны быть лицо, плечи и кисти. Запись длится 6 секунд, затем появится ответ и начнётся следующий показ — без повторных нажатий.",
              "Keep your face, shoulders and hands visible. Each 6-second recording is followed by a result and the next recording, automatically.",
              "Бет, иық пен қол кадрда болсын. Әр 6 секундтық жазбадан кейін нәтиже шығып, келесі жазба автоматты басталады.",
            )}
          </p>
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
            {phase === "recording" && (
              <span className="krsl-countdown" aria-label="Осталось секунд">
                {remaining}
              </span>
            )}
            {phase === "starting" && <span className="krsl-countdown">…</span>}
          </div>
          <div className="recognition-edit-tools">
            <button
              className="button primary"
              onClick={start}
              disabled={active || !health?.ready}
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
          {!health?.ready && (
            <button className="button secondary" onClick={check}>
              <RefreshCw size={16} />
              {at(
                "Проверить подключение",
                "Retry connection",
                "Қосылымды тексеру",
              )}
            </button>
          )}
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
              {at("руки", "hands", "қол")}{" "}
              {Math.round(result.tracking.hands * 100)}% ·{" "}
              {at("тело", "body", "дене")}{" "}
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
          <p className="recognition-privacy">
            {at(
              "До 20 секунд · 25 МБ · до Full HD. Видео обрабатывается локальным сервисом на этом компьютере и удаляется после обработки. Звук не записывается.",
              "Up to 20 seconds · 25 MB · Full HD. Video is processed by the local service on this computer and deleted afterwards. No audio is recorded.",
              "20 секундқа дейін · 25 МБ · Full HD. Бейне осы компьютерде өңделіп, кейін жойылады. Дыбыс жазылмайды.",
            )}
          </p>
        </section>
        <aside className="panel recognition-captions">
          <div className="recognition-caption-heading">
            <h2>{at("Субтитры", "Captions", "Субтитрлер")}</h2>
            <span>{at("Черновик ИИ", "AI draft", "ЖИ нобайы")}</span>
          </div>
          <p>
            {at(
              "Каждый показ — новая строка. Проверьте результат и исправьте ошибки.",
              "Each recording adds a line. Review and correct the result.",
              "Әр көрсетілім жаңа жолға жазылады. Нәтижені тексеріп, қателерді түзетіңіз.",
            )}
          </p>
          <label htmlFor="krsl-text">
            {at("Распознанные слова", "Recognized words", "Танылған сөздер")}
          </label>
          <textarea
            id="krsl-text"
            rows={8}
            maxLength={4000}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={at(
              "Здесь появятся слова из вашего видео…",
              "Words from your video will appear here…",
              "Бейнедегі сөздер осында шығады…",
            )}
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
                "Она читает последовательность ориентиров двух рук, плеч, локтей, бровей и рта. Буквы распознаёт отдельный режим. Автоматические фрагменты могут обрывать длинные фразы; для целой фразы загрузите видео.",
                "It reads landmarks from both hands, shoulders, elbows, brows and mouth. Letters use a separate mode. Automatic chunks may split long phrases; upload a video for a complete phrase.",
                "Екі қол, иық, шынтақ, қас және ауыз бағдарларын оқиды. Әріптер жеке режимде танылады. Ұзақ сөйлемдер үзілуі мүмкін; толық сөйлем үшін бейне жүктеңіз.",
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
