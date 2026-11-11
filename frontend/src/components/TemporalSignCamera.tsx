import { useEffect, useRef, useState } from "react";
import { Hand, Camera, Upload } from "lucide-react";
import "./sign-action-cards.css";
import type {
  HandLandmarker,
  HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { validClassifier, type SignClassifier } from "../sign/recognition";
import {
  temporalFrame,
  recognizeSequence,
  type TemporalFrame,
} from "../sign/temporal";
import { at } from "../i18n/automation";
import {
  LiveLetterStream,
  trackingQuality,
  type TrackingQuality,
} from "../sign/liveRecognition";
import { drawHandOverlay } from "../sign/handOverlay";
export type SignPrediction = ReturnType<typeof recognizeSequence>;
type CameraProps = {
  expected?: string;
  onPrediction?: (prediction: SignPrediction) => void;
};
export function TemporalSignCamera({ expected, onPrediction }: CameraProps) {
  return (
    <TemporalCameraSession
      key={expected}
      expected={expected}
      cautious={false}
      onPrediction={onPrediction}
    />
  );
}
function TemporalCameraSession({
  expected,
  cautious,
  onPrediction,
}: CameraProps & { cautious: boolean }) {
  const [automatic, setAutomatic] = useState(true);
  const live = useRef(new LiveLetterStream());
  const [quality, setQuality] = useState<TrackingQuality>("missing");
  const [liveProgress, setLiveProgress] = useState(0);
  const capturing = useRef(false);
  function publish(prediction: SignPrediction) {
    setResult(prediction);
    onPrediction?.(prediction);
  }
  const video = useRef<HTMLVideoElement>(null),
    overlay = useRef<HTMLCanvasElement>(null),
    loading = useRef<Promise<void>>(),
    detector = useRef<HandLandmarker>(),
    model = useRef<SignClassifier>(),
    stream = useRef<MediaStream>(),
    alive = useRef(true),
    generation = useRef(0),
    fileUrl = useRef("");
  const [handCount, setHandCount] = useState<number | null>(null),
    [filePreview, setFilePreview] = useState(false),
    [aspect, setAspect] = useState(4 / 3);
  const [operation, setOperation] = useState<"model" | "camera" | "video">(
    "model",
  );
  const [busy, setBusy] = useState(false),
    [active, setActive] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [result, setResult] = useState<ReturnType<typeof recognizeSequence>>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = undefined;
      disposeDetector();
      if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
    };
  }, []);
  function disposeDetector() {
    const previous = detector.current;
    detector.current = undefined;
    model.current = undefined;
    try {
      previous?.close();
    } catch {
      /* A crashed WASM context may already be closed. */
    }
  }
  function stop() {
    generation.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = undefined;
    if (video.current) {
      video.current.pause();
      video.current.srcObject = null;
    }
    setActive(false);
    live.current.reset();
    setLiveProgress(0);
    setQuality("missing");
    capturing.current = false;
    setFilePreview(false);
    setHandCount(null);
    if (overlay.current)
      overlay.current
        .getContext("2d")
        ?.clearRect(0, 0, overlay.current.width, overlay.current.height);
    setBusy(false);
    setProgress(0);
  }
  async function load() {
    if (detector.current && model.current) return;
    if (loading.current) return loading.current;
    loading.current = (async () => {
      const [{ FilesetResolver, HandLandmarker }, response] = await Promise.all(
        [
          import("@mediapipe/tasks-vision"),
          fetch(
            `/models/rsl/alphabet${cautious ? "-cautious" : ""}-classifier.json`,
          ),
        ],
      );
      if (!response.ok) throw Error("model");
      const m = await response.json();
      if (!validClassifier(m) || m.mean.length !== 474) throw Error("model");
      const d = await HandLandmarker.createFromOptions(
        await FilesetResolver.forVisionTasks("/models/rsl/wasm"),
        {
          baseOptions: {
            modelAssetPath: "/models/rsl/hand_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "IMAGE",
          numHands: 2,
        },
      );
      if (!alive.current) {
        d.close();
        return;
      }
      detector.current = d;
      model.current = m;
    })();
    try {
      await loading.current;
    } finally {
      loading.current = undefined;
    }
  }
  function paint(
    source: HTMLVideoElement,
    detected: HandLandmarkerResult,
    fromFile = false,
  ) {
    if (overlay.current)
      drawHandOverlay(overlay.current, source, detected, fromFile);
    setHandCount(detected.landmarks.length);
    if (source.videoWidth && source.videoHeight)
      setAspect(source.videoWidth / source.videoHeight);
  }
  // Live feedback is separate from classification of a complete 16-frame sign.
  // IMAGE mode matches offline extraction; throttle inference and skip duplicate frames.
  useEffect(() => {
    if (!active || busy) return;
    if (!detector.current || !stream.current?.active) {
      setActive(false);
      setBusy(false);
      return;
    }
    const token = generation.current;
    let frame = 0,
      lastTime = -1,
      lastRun = -Infinity;
    const tick = (now: number) => {
      if (!alive.current || token !== generation.current) return;
      const source = video.current;
      if (
        source &&
        source.readyState >= 2 &&
        source.currentTime !== lastTime &&
        now - lastRun >= 66
      ) {
        try {
          lastTime = source.currentTime;
          lastRun = now;
          const detected = detector.current!.detect(source);
          paint(source, detected);
          const nextQuality = trackingQuality(detected);
          setQuality(nextQuality);
          if (automatic) {
            const frames = live.current.sample(
              temporalFrame(detected),
              now,
              nextQuality,
            );
            setLiveProgress(live.current.progress);
            if (frames) {
              const prediction = recognizeSequence(frames, model.current!);
              if (live.current.confirm(prediction)) publish(prediction);
              else if (!prediction?.accepted) setResult(prediction);
            }
          }
        } catch (e) {
          stop();
          disposeDetector();
          fail(e, "tracking");
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, busy, automatic]);
  function fail(
    reason?: unknown,
    stage: "model" | "camera" | "video" | "tracking" = "video",
  ) {
    if (!alive.current) return;
    const name = reason instanceof Error ? reason.name : "";
    setError(
      stage === "model"
        ? at(
            "Не загрузилась модель распознавания. Обновите страницу и попробуйте ещё раз.",
            "The recognition model could not load. Reload and try again.",
            "Тану моделі жүктелмеді. Бетті жаңартып, қайта көріңіз.",
          )
        : name === "NotAllowedError" || name === "SecurityError"
          ? at(
              "Доступ к камере запрещён. Разрешите камеру в настройках этого сайта или проверьте видеофайл.",
              "Camera access is blocked. Allow it in site settings or check a video file.",
              "Камераға рұқсат жоқ. Сайт баптауларында рұқсат беріңіз немесе бейнефайлды тексеріңіз.",
            )
          : name === "NotFoundError"
            ? at(
                "Камера не найдена. Подключите её или выберите видеофайл.",
                "No camera found. Connect one or choose a video file.",
                "Камера табылмады. Оны қосыңыз немесе бейнефайлды таңдаңыз.",
              )
            : name === "NotReadableError"
              ? at(
                  "Камера занята другим приложением или недоступна. Закройте другие приложения с камерой.",
                  "Camera is busy or unavailable. Close other camera apps.",
                  "Камера бос емес не қолжетімсіз. Камера қолданатын басқа қолданбаларды жабыңыз.",
                )
              : stage === "camera"
                ? at(
                    "Камера не запустилась. Откройте сайт через HTTPS или localhost и проверьте разрешение камеры.",
                    "Camera could not start. Use HTTPS or localhost and check permission.",
                    "Камера қосылмады. HTTPS не localhost арқылы ашып, рұқсатты тексеріңіз.",
                  )
                : stage === "tracking"
                  ? at(
                      "Отслеживание рук прервалось. Включите камеру повторно.",
                      "Hand tracking stopped. Start the camera again.",
                      "Қолды бақылау үзілді. Камераны қайта қосыңыз.",
                    )
                  : at(
                      "Не удалось прочитать видео. Выберите MP4/WebM до 30 МБ, длиной 0,5–15 секунд.",
                      "Could not read video. Choose a 0.5–15 second MP4/WebM under 30 MB.",
                      "Бейне оқылмады. 30 МБ-тан кіші, 0,5–15 секундтық MP4/WebM таңдаңыз.",
                    ),
    );
  }
  async function start() {
    stop();
    const token = generation.current;
    setError("");
    setResult(null);
    setBusy(true);
    setOperation("model");
    let stage: "model" | "camera" = "model";
    try {
      await load();
      if (!alive.current || token !== generation.current) return;
      stage = "camera";
      setOperation("camera");
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error("camera unavailable");
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      if (!alive.current || token !== generation.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      media.getVideoTracks().forEach((track) => {
        track.onended = () => {
          if (alive.current && token === generation.current) {
            stop();
            fail(new Error("camera ended"), "camera");
          }
        };
      });
      video.current!.removeAttribute("src");
      video.current!.srcObject = media;
      await video.current!.play();
      if (alive.current && token === generation.current) {
        setAutomatic(true);
        setActive(true);
      }
    } catch (e) {
      if (alive.current && token === generation.current) {
        stop();
        fail(e, stage);
      }
    } finally {
      if (alive.current && token === generation.current) setBusy(false);
    }
  }
  async function record() {
    if (capturing.current) return;
    capturing.current = true;
    live.current.reset();
    const token = generation.current;
    setBusy(true);
    setResult(null);
    setError("");
    const frames: TemporalFrame[] = [];
    try {
      for (let i = 0; i < 16; i++) {
        if (!alive.current || token !== generation.current) return;
        const detected = detector.current!.detect(video.current!);
        paint(video.current!, detected);
        frames.push(temporalFrame(detected));
        setProgress(i + 1);
        if (i < 15) await new Promise((r) => setTimeout(r, 180));
      }
      if (alive.current && token === generation.current)
        publish(recognizeSequence(frames, model.current!));
    } catch (e) {
      if (alive.current && token === generation.current) {
        stop();
        disposeDetector();
        fail(e, "tracking");
      }
    } finally {
      if (alive.current && token === generation.current) {
        capturing.current = false;
        setBusy(false);
      }
    }
  }
  async function inspect(file?: File) {
    if (!file) return;
    stop();
    const token = generation.current;
    setError("");
    setResult(null);
    setBusy(true);
    let clip: HTMLVideoElement | undefined;
    let stage: "model" | "video" = "video";
    try {
      if (!file.type.startsWith("video/") || file.size > 30 * 1024 * 1024)
        throw Error("file");
      stage = "model";
      setOperation("model");
      await load();
      stage = "video";
      setOperation("video");
      if (!alive.current || token !== generation.current) return;
      if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
      fileUrl.current = URL.createObjectURL(file);
      clip = document.createElement("video");
      clip.muted = true;
      clip.preload = "auto";
      const metadata = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(Error("metadata timeout")),
          10000,
        );
        clip!.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };
        clip!.onerror = () => {
          clearTimeout(timeout);
          reject(Error("video"));
        };
      });
      clip.src = fileUrl.current;
      await metadata;
      if (
        !Number.isFinite(clip.duration) ||
        clip.duration < 0.5 ||
        clip.duration > 15
      )
        throw Error("duration");
      const frames: TemporalFrame[] = [];
      for (let i = 0; i < 16; i++) {
        if (!alive.current || token !== generation.current) return;
        const t = ((clip.duration - 0.04) * i) / 15 + 0.001;
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(Error("seek")), 5000);
          clip!.onseeked = () => {
            clearTimeout(timeout);
            resolve();
          };
          clip!.currentTime = t;
        });
        if (!alive.current || token !== generation.current) return;
        const detected = detector.current!.detect(clip);
        setFilePreview(true);
        paint(clip, detected, true);
        frames.push(temporalFrame(detected));
        setProgress(i + 1);
      }
      if (alive.current && token === generation.current)
        publish(recognizeSequence(frames, model.current!));
    } catch (e) {
      if (alive.current && token === generation.current) fail(e, stage);
    } finally {
      clip?.removeAttribute("src");
      clip?.load();
      if (alive.current && token === generation.current) setBusy(false);
    }
  }
  return (
    <section id="sign-camera-check" className="sign-camera panel">
      <span className="sign-status-label">
        {at(
          "ИИ · 33 буквы · эксперимент",
          "AI · 33 letters · experimental",
          "ЖИ · 33 әріп · тәжірибе",
        )}
      </span>
      <h2>
        {expected ? (
          <>
            {at("Покажите букву", "Show the letter", "Әріпті көрсетіңіз")} «
            {expected}»
          </>
        ) : (
          at("Камера → текст", "Camera → text", "Камера → мәтін")
        )}
      </h2>
      <p className="sign-camera-intro">
        {at(
          "Покажите одну букву. Модель попробует определить её по движению руки.",
          "Show one letter. The model will try to identify it from your hand movement.",
          "Бір әріпті көрсетіңіз. Модель оны қол қимылынан анықтауға тырысады.",
        )}
      </p>
      {!active && !filePreview && (
        <div className="sign-camera-onboarding">
          <div className="sign-camera-illustration" aria-hidden="true">
            <span className="sign-camera-corner" />
            <Hand strokeWidth={1.25} />
            <span className="sign-camera-scan" />
            <span className="sign-camera-letter">{expected || "А–Я"}</span>
            <span className="sign-camera-off">
              <Camera size={14} />
              {at("Камера выключена", "Camera is off", "Камера өшірулі")}
            </span>
          </div>
          <ol className="sign-camera-steps">
            <li>
              <span>1</span>
              <div>
                <strong>
                  {at(
                    "Включите камеру",
                    "Start the camera",
                    "Камераны қосыңыз",
                  )}
                </strong>
                <p>
                  {at(
                    "Кисть целиком в кадре, лицо и руки хорошо освещены.",
                    "Keep your whole hand in frame, with good lighting.",
                    "Қол толық кадрда, жарық жеткілікті болсын.",
                  )}
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>
                  {at("Покажите букву", "Show a letter", "Әріпті көрсетіңіз")}
                </strong>
                <p>
                  {at(
                    "Распознавание начнётся само. Показывайте одну букву около 3 секунд.",
                    "Recognition starts automatically. Show one letter for about 3 seconds.",
                    "Тану автоматты басталады. Бір әріпті шамамен 3 секунд көрсетіңіз.",
                  )}
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>
                  {at(
                    "Проверьте результат",
                    "Check the result",
                    "Нәтижені тексеріңіз",
                  )}
                </strong>
                <p>
                  {at(
                    "ИИ предложит букву или попросит повторить. Он может ошибаться.",
                    "AI suggests a letter or asks you to retry. It can make mistakes.",
                    "ЖИ әріпті ұсынады не қайталауды сұрайды. Ол қателесуі мүмкін.",
                  )}
                </p>
              </div>
            </li>
          </ol>
        </div>
      )}
      <div
        className="sign-tracking-view"
        hidden={!active && !filePreview}
        style={{ aspectRatio: aspect, width: `min(100%, ${360 * aspect}px)` }}
        data-mirrored={active}
      >
        <video ref={video} playsInline muted hidden={!active} />
        <canvas
          ref={overlay}
          role="img"
          aria-label={at(
            "Точки кистей и соединения пальцев",
            "Hand landmarks and finger connections",
            "Қол нүктелері мен саусақ байланыстары",
          )}
        />
      </div>
      {(active || filePreview) && (
        <p className="sign-tracking-status" role="status">
          {handCount === null
            ? at("Ищем руки…", "Looking for hands…", "Қол ізделуде…")
            : handCount === 0
              ? at(
                  "Руки не видны. Покажите кисть целиком перед камерой.",
                  "No hands visible. Show your whole hand.",
                  "Қол көрінбейді. Қолыңызды толық көрсетіңіз.",
                )
              : `${at("Рук в кадре", "Hands in frame", "Кадрдағы қол саны")}: ${handCount} · ${at("Точек", "Landmarks", "Нүктелер")}: ${handCount * 21}`}
          {filePreview &&
            ` · ${at("Кадр из видео", "Video frame", "Бейнеден кадр")}`}
        </p>
      )}
      {active && automatic && (
        <div className="sign-live-feedback" role="status">
          <strong>
            {quality === "missing"
              ? at(
                  "Покажите руку — распознавание уже включено",
                  "Show your hand — recognition is running",
                  "Қолыңызды көрсетіңіз — тану қосулы",
                )
              : quality === "clipped"
                ? at(
                    "Отведите руку от края кадра",
                    "Move your hand away from the edge",
                    "Қолыңызды кадр шетінен алыстатыңыз",
                  )
                : quality === "distant"
                  ? at(
                      "Поднесите руку немного ближе",
                      "Bring your hand a little closer",
                      "Қолыңызды сәл жақындатыңыз",
                    )
                  : at(
                      "Читаем движение автоматически…",
                      "Reading movement automatically…",
                      "Қимыл автоматты оқылуда…",
                    )}
          </strong>
          <progress
            max={100}
            value={liveProgress}
            aria-label={at(
              "Сбор движения",
              "Movement capture",
              "Қимылды жинау",
            )}
          />
          <small>
            {at(
              "21 точка на каждой кисти · ответ после двух согласующихся проверок",
              "21 landmarks per hand · response after two agreeing checks",
              "Әр қолда 21 нүкте · екі сәйкес тексеруден кейін жауап",
            )}
          </small>
        </div>
      )}
      {active && (
        <div className="caption-auto-control">
          <label>
            <input
              type="checkbox"
              checked={automatic}
              disabled={busy}
              onChange={(e) => {
                setAutomatic(e.target.checked);
                live.current.reset();
                setLiveProgress(0);
              }}
            />
            {at(
              "Автоматическое распознавание",
              "Automatic recognition",
              "Автоматты тану",
            )}
          </label>
          <p>
            {at(
              "Покажите букву и дождитесь ответа — затем следующую. Для двух одинаковых букв подряд опустите руку из кадра на секунду. Слова жестами пока не поддерживаются.",
              "Show a letter and wait for the result, then show the next. To repeat the same letter, lower your hand out of frame for a second. Word signs are not supported yet.",
              "Әріпті көрсетіп, жауапты күтіңіз, содан кейін келесісін көрсетіңіз. Бірдей әріпті қайталау үшін қолды бір секундқа кадрдан алыңыз. Сөз ымдары әзірге танылмайды.",
            )}
          </p>
        </div>
      )}
      <div className="sign-camera-actions">
        {!active && (
          <button
            className="button primary"
            disabled={busy || active}
            onClick={start}
          >
            <Camera size={18} />
            {at("Включить камеру", "Start camera", "Камераны қосу")}
          </button>
        )}
        {active && !automatic && (
          <button className="button primary" disabled={busy} onClick={record}>
            {at(
              "Распознать букву · 3 с",
              "Recognize letter · 3 s",
              "Әріпті тану · 3 с",
            )}
          </button>
        )}
        {(active || busy) && (
          <button
            className="button secondary"
            disabled={!active && !busy}
            onClick={stop}
          >
            {at("Остановить", "Stop", "Тоқтату")}
          </button>
        )}
        <label className="button secondary">
          <Upload size={17} />
          {at("Загрузить видео", "Upload video", "Бейне жүктеу")}
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            disabled={busy}
            onChange={(e) => {
              inspect(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {busy && (
        <p role="status">
          {progress
            ? `${at("Обработка кадров", "Processing frames", "Кадрларды өңдеу")}: ${progress}/16`
            : operation === "camera"
              ? at(
                  "Запускаем камеру… Если браузер запросит доступ, разрешите его.",
                  "Starting camera… Allow access if your browser asks.",
                  "Камера қосылуда… Браузер сұраса, рұқсат беріңіз.",
                )
              : operation === "video"
                ? at("Читаем видео…", "Reading video…", "Бейне оқылуда…")
                : at(
                    "Подготовка модели…",
                    "Preparing model…",
                    "Модель дайындалуда…",
                  )}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {result && (
        <div className="sign-recognition-result" role="status">
          {result.accepted ? (
            <>
              <h3>
                {at("Модель распознала", "Model prediction", "Модель таныды")}:{" "}
                {result.label}
              </h3>
              <p>
                {!expected
                  ? at(
                      "Проверьте букву в субтитрах. Исправьте её, если модель ошиблась.",
                      "The letter was added to the captions. Correct it if needed.",
                      "Әріп субтитрге қосылды. Қажет болса, түзетіңіз.",
                    )
                  : result.label === expected
                    ? at(
                        "Совпало с выбранной буквой. Сверьте положение руки и движение с образцом.",
                        "Matches the selected letter. Compare hand position and movement with the reference.",
                        "Таңдалған әріппен сәйкес. Қол қалпы мен қимылды үлгімен салыстырыңыз.",
                      )
                    : at(
                        "Результат отличается от выбранной буквы. Это может быть ошибка модели; сравните видео, а не только ответ ИИ.",
                        "The result differs from the selected letter. The model may be wrong; compare the video too.",
                        "Нәтиже таңдалған әріптен өзгеше. Модель қателесуі мүмкін; бейнемен де салыстырыңыз.",
                      )}
              </p>
            </>
          ) : (
            <>
              <h3>
                {at(
                  "Не удалось уверенно определить букву",
                  "No confident letter prediction",
                  "Әріп сенімді анықталмады",
                )}
              </h3>
              <p>
                {at(
                  "Покажите кисть целиком, добавьте света и повторите движение. Модель может отказаться даже от правильного показа.",
                  "Show the whole hand, add light and repeat. The model can reject a correct sign.",
                  "Қолды толық көрсетіп, жарықты көбейтіңіз. Модель дұрыс қимылды да танымауы мүмкін.",
                )}
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
