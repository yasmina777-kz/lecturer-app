import { useEffect, useRef, useState } from "react";
import { Camera, Square, Upload } from "lucide-react";
import { at } from "../i18n/automation";
import {
  classifyFeatures,
  handFeatures,
  type SignClassifier,
} from "../sign/recognition";
import type {
  HandLandmarker,
  HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
export function SignCamera({ expected }: { expected: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const detector = useRef<HandLandmarker>();
  const classifier = useRef<SignClassifier>();
  const stream = useRef<MediaStream>();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const alive = useRef(true);
  const running = useRef(false);
  const generation = useRef(0);
  const [active, setActive] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [result, setResult] =
    useState<ReturnType<typeof classifyFeatures>>(null);
  const [preview, setPreview] = useState("");
  const imageUrl = useRef("");
  function stop() {
    generation.current++;
    running.current = false;
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = undefined;
    if (video.current) video.current.srcObject = null;
    setActive(false);
    setBusy(false);
    setResult(null);
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
      running.current = false;
      clearTimeout(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      detector.current?.close();
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    };
  }, []);
  useEffect(() => {
    setResult(null);
    setMessage("");
  }, [expected]);
  async function load() {
    if (detector.current && classifier.current) return;
    const [{ FilesetResolver, HandLandmarker }, response] = await Promise.all([
      import("@mediapipe/tasks-vision"),
      fetch("/models/rsl/classifier.json"),
    ]);
    if (!response.ok) throw new Error("model");
    const model = await response.json();
    const vision = await FilesetResolver.forVisionTasks("/models/rsl/wasm");
    const d = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/models/rsl/hand_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "IMAGE",
      numHands: 1,
    });
    if (!alive.current) {
      d.close();
      return;
    }
    detector.current = d;
    classifier.current = model;
  }
  function show(detection: HandLandmarkerResult) {
    if (!alive.current) return;
    const hand = detection.worldLandmarks[0];
    if (!hand) {
      setResult(null);
      setMessage(
        at(
          "Не вижу кисть целиком. Поднесите руку к камере и добавьте света.",
          "No complete hand detected. Move your hand into view and add light.",
          "Қол толық көрінбейді. Қолыңызды көрсетіп, жарықты көбейтіңіз.",
        ),
      );
      return;
    }
    const f = handFeatures(hand),
      r =
        f && classifier.current
          ? classifyFeatures(f, classifier.current)
          : null;
    setResult(r);
    setMessage(
      r?.accepted
        ? ""
        : at(
            "Не уверена. Покажите букву чётче и задержите руку.",
            "Uncertain. Show the letter clearly and hold your hand still.",
            "Сенімді емес. Әріпті анық көрсетіп, қолды ұстап тұрыңыз.",
          ),
    );
  }
  async function start() {
    stop();
    const token = generation.current;
    setBusy(true);
    setError("");
    setMessage("");
    setPreview("");
    try {
      await load();
      if (!alive.current || token !== generation.current) return;
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      if (!alive.current || token !== generation.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      video.current!.srcObject = media;
      await video.current!.play();
      if (!alive.current || token !== generation.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      running.current = true;
      setActive(true);
      const tick = () => {
        if (!running.current || !alive.current) return;
        try {
          if (video.current && video.current.readyState >= 2)
            show(detector.current!.detect(video.current));
        } catch {
          stop();
          setError(
            at(
              "Не удалось обработать кадр. Попробуйте снова.",
              "Could not process the frame. Try again.",
              "Кадр өңделмеді. Қайталап көріңіз.",
            ),
          );
          return;
        }
        timer.current = setTimeout(tick, 250);
      };
      tick();
    } catch (e) {
      stop();
      if (alive.current)
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? at(
                "Доступ к камере не разрешён. Можно выбрать фото руки.",
                "Camera permission denied. You can choose a hand photo.",
                "Камераға рұқсат жоқ. Қол суретін таңдауға болады.",
              )
            : at(
                "Не удалось включить проверку. Проверьте камеру и загрузку модели.",
                "Could not start. Check the camera and model download.",
                "Тексеру іске қосылмады. Камера мен модельді тексеріңіз.",
              ),
        );
    } finally {
      if (alive.current && token === generation.current) setBusy(false);
    }
  }
  async function inspect(file?: File) {
    if (!file) return;
    stop();
    const token = generation.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024)
        throw new Error("file");
      await load();
      if (!alive.current || token !== generation.current) return;
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
      imageUrl.current = URL.createObjectURL(file);
      const img = new Image();
      img.src = imageUrl.current;
      await img.decode();
      if (!alive.current || token !== generation.current) return;
      setPreview(imageUrl.current);
      show(detector.current!.detect(img));
    } catch {
      if (alive.current)
        setError(
          at(
            "Не удалось открыть изображение. Выберите JPG или PNG до 15 МБ.",
            "Could not read image. Choose a JPG or PNG under 15 MB.",
            "Сурет ашылмады. 15 МБ-тан кіші JPG немесе PNG таңдаңыз.",
          ),
        );
    } finally {
      if (alive.current && token === generation.current) setBusy(false);
    }
  }
  return (
    <section className="sign-camera panel">
      <h2>
        {at(
          "Повторите перед камерой",
          "Repeat in front of the camera",
          "Камера алдында қайталаңыз",
        )}
      </h2>
      <p>
        {at(
          "Покажите одну букву:",
          "Show one letter:",
          "Бір әріпті көрсетіңіз:",
        )}{" "}
        <b>{expected}</b>.{" "}
        {at(
          "Проверка работает на устройстве, фото и видео не отправляются на сервер.",
          "Processing stays on your device. Photos and video are not uploaded.",
          "Өңдеу құрылғыда жүреді. Фото мен бейне серверге жіберілмейді.",
        )}
      </p>
      <div className="sign-camera-media" hidden={!active && !preview}>
        <video ref={video} playsInline muted hidden={!active} />
        {preview && (
          <img
            src={preview}
            alt={at(
              "Выбранное фото для проверки",
              "Selected practice photo",
              "Тексеруге таңдалған сурет",
            )}
          />
        )}
      </div>
      <div className="sign-camera-actions">
        {active ? (
          <button className="button secondary" onClick={stop}>
            <Square size={16} />
            {at("Выключить камеру", "Stop camera", "Камераны өшіру")}
          </button>
        ) : (
          <button className="button primary" disabled={busy} onClick={start}>
            <Camera size={18} />
            {busy
              ? at("Загрузка…", "Loading…", "Жүктелуде…")
              : at("Включить камеру", "Start camera", "Камераны қосу")}
          </button>
        )}
        <label className="button secondary">
          <Upload size={17} />
          {at("Проверить фото", "Check photo", "Фотоны тексеру")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => {
              void inspect(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <div aria-live="polite" className="sign-camera-result">
        {error && <p role="alert">{error}</p>}
        {message && <p>{message}</p>}
        {result?.accepted && (
          <p>
            <b>
              {at(
                "Модель распознала:",
                "Model prediction:",
                "Модель таныған әріп:",
              )}{" "}
              {result.label}
            </b>
            <br />
            {result.label === expected
              ? at(
                  "Похоже на выбранную букву. Сравните положение руки с образцом.",
                  "Looks like the selected letter. Compare your hand with the reference.",
                  "Таңдалған әріпке ұқсайды. Қол қалпын үлгімен салыстырыңыз.",
                )
              : at(
                  "Получилась другая буква. Посмотрите образец и попробуйте ещё раз.",
                  "A different letter was detected. Watch the reference and try again.",
                  "Басқа әріп анықталды. Үлгіні қарап, қайталаңыз.",
                )}
          </p>
        )}
      </div>
      <small>
        {at(
          "Пилотная модель различает только А, В, Л. Другие жесты тоже могут быть ошибочно приняты за эти буквы. Это подсказка, а не оценка правильности РЖЯ.",
          "Pilot model distinguishes only А, В, Л. Other signs may be misclassified as these letters. This is a hint, not an RSL proficiency assessment.",
          "Сынақ моделі тек А, В, Л әріптерін ажыратады. Басқа ымдарды да қате тануы мүмкін. Бұл — кеңес, ым тілін меңгеру бағасы емес.",
        )}
      </small>
      <details>
        <summary>
          {at(
            "На чём обучен ИИ",
            "How the AI was trained",
            "ЖИ қалай оқытылды",
          )}
        </summary>
        <p>
          {at(
            "Наш классификатор обучен на видео Bukva. Готовая модель MediaPipe находит точки кисти; наш классификатор определяет букву по расстояниям между ними.",
            "Our classifier was trained on Bukva videos. Pretrained MediaPipe detects hand landmarks; our classifier predicts a letter from distances between them.",
            "Классификатор Bukva бейнелерінде оқытылды. MediaPipe қол нүктелерін табады, ал біздің модель арақашықтықтар арқылы әріпті анықтайды.",
          )}
        </p>
        <a
          href="/research/rsl/training-report.html"
          target="_blank"
          rel="noreferrer"
        >
          {at(
            "Отчёт обучения и ошибки ↗",
            "Training report and errors ↗",
            "Оқыту есебі мен қателер ↗",
          )}
        </a>{" "}
        ·{" "}
        <a
          href="https://github.com/ai-forever/bukva"
          target="_blank"
          rel="noreferrer"
        >
          Bukva
        </a>
      </details>
    </section>
  );
}
