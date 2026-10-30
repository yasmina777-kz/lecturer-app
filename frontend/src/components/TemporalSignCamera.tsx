import { useEffect, useRef, useState } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import type { SignClassifier } from "../sign/recognition";
import {
  temporalFrame,
  recognizeSequence,
  type TemporalFrame,
} from "../sign/temporal";
import { at } from "../i18n/automation";
export function TemporalSignCamera({ expected }: { expected: string }) {
  const video = useRef<HTMLVideoElement>(null),
    detector = useRef<HandLandmarker>(),
    model = useRef<SignClassifier>(),
    stream = useRef<MediaStream>(),
    alive = useRef(true),
    generation = useRef(0),
    fileUrl = useRef("");
  const [busy, setBusy] = useState(false),
    [active, setActive] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [result, setResult] = useState<ReturnType<typeof recognizeSequence>>(null);
  const [report, setReport] = useState<{
    accuracy: number;
    acceptedAccuracy: number | null;
    acceptedCoverage: number;
    trainVideos: number;
    testVideos: number;
  } | null>(null);
  useEffect(() => {
    alive.current = true;
    const abort = new AbortController();
    fetch("/models/rsl/alphabet-report.json", { signal: abort.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((r) => {
        if (alive.current) setReport(r);
      })
      .catch(() => {});
    return () => {
      alive.current = false;
      generation.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
      detector.current?.close();
      if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
      abort.abort();
    };
  }, []);
  function stop() {
    generation.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = undefined;
    if (video.current) {
      video.current.pause();
      video.current.srcObject = null;
    }
    setActive(false);
    setBusy(false);
    setProgress(0);
  }
  async function load() {
    if (detector.current && model.current) return;
    const [{ FilesetResolver, HandLandmarker }, response] = await Promise.all([
      import("@mediapipe/tasks-vision"),
      fetch("/models/rsl/alphabet-classifier.json"),
    ]);
    if (!response.ok) throw Error("model");
    const m = await response.json();
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
  }
  function fail() {
    if (alive.current)
      setError(
        at(
          "Не удалось обработать видео. Проверьте разрешение камеры или выберите MP4/WebM до 30 МБ, длиной 0,5–15 секунд.",
          "Could not process video. Check camera permission or choose a 0.5–15 second MP4/WebM under 30 MB.",
          "Бейне өңделмеді. Камера рұқсатын тексеріңіз не 30 МБ-тан кіші, 0,5–15 секундтық MP4/WebM таңдаңыз.",
        ),
      );
  }
  async function start() {
    stop();
    const token = generation.current;
    setError("");
    setResult(null);
    setBusy(true);
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
      video.current!.removeAttribute("src");
      video.current!.srcObject = media;
      await video.current!.play();
      if (alive.current && token === generation.current) setActive(true);
    } catch {
      fail();
    } finally {
      if (alive.current && token === generation.current) setBusy(false);
    }
  }
  async function record() {
    const token = generation.current;
    setBusy(true);
    setResult(null);
    setError("");
    const frames: TemporalFrame[] = [];
    try {
      for (let i = 0; i < 16; i++) {
        if (!alive.current || token !== generation.current) return;
        frames.push(temporalFrame(detector.current!.detect(video.current!)));
        setProgress(i + 1);
        if (i < 15) await new Promise((r) => setTimeout(r, 180));
      }
      if (alive.current && token === generation.current)
        setResult(recognizeSequence(frames, model.current!));
    } catch {
      fail();
    } finally {
      if (alive.current && token === generation.current) setBusy(false);
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
    try {
      if (!file.type.startsWith("video/") || file.size > 30 * 1024 * 1024)
        throw Error("file");
      await load();
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
        frames.push(temporalFrame(detector.current!.detect(clip)));
        setProgress(i + 1);
      }
      if (alive.current && token === generation.current)
        setResult(recognizeSequence(frames, model.current!));
    } catch {
      fail();
    } finally {
      clip?.removeAttribute("src");
      clip?.load();
      if (alive.current && token === generation.current) setBusy(false);
    }
  }
  return (
    <section className="sign-camera panel">
      <span className="sign-status-label">
        {at(
          "ИИ · 33 буквы · эксперимент",
          "AI · 33 letters · experimental",
          "ЖИ · 33 әріп · тәжірибе",
        )}
      </span>
      <h2>
        {at("Покажите букву", "Show the letter", "Әріпті көрсетіңіз")} «
        {expected}»
      </h2>
      <p>
        {at(
          "Камера проверяет короткое движение целиком. Включите камеру, подготовьтесь и нажмите «Записать жест». Фото не подходит для букв с движением.",
          "The camera checks a short complete movement. Start the camera, get ready, then record. A photo cannot show dynamic letters.",
          "Камера қысқа қимылды толық тексереді. Камераны қосып, дайындалып, қимылды жазыңыз. Фото қозғалысты әріптерге жарамайды.",
        )}
      </p>
      <video
        ref={video}
        playsInline
        muted
        hidden={!active}
        className="sign-sequence-camera"
      />
      <div className="sign-camera-actions">
        <button
          className="button primary"
          disabled={busy || active}
          onClick={start}
        >
          {at("Включить камеру", "Start camera", "Камераны қосу")}
        </button>
        {active && (
          <button className="button primary" disabled={busy} onClick={record}>
            {at(
              "Записать жест · 3 с",
              "Record sign · 3 s",
              "Қимылды жазу · 3 с",
            )}
          </button>
        )}
        <button
          className="button secondary"
          disabled={!active && !busy}
          onClick={stop}
        >
          {at("Остановить", "Stop", "Тоқтату")}
        </button>
        <label className="button secondary">
          {at("Проверить видео", "Check video", "Бейнені тексеру")}
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
                {result.label === expected
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
      <small>
        {at(
          "Обработка на устройстве, без отправки видео. Модель распознаёт отдельные буквы; слова, грамматику и правильность мимики она не оценивает.",
          "Processed on your device without uploads. The model recognizes isolated letters, not words, grammar or facial correctness.",
          "Бейне жіберілмейді, өңдеу құрылғыда жүреді. Модель жеке әріптерді таниды; сөздер, грамматика мен мимиканы бағаламайды.",
        )}
      </small>
      <details>
        <summary>
          {at(
            "Результаты обучения и ограничения",
            "Training results and limitations",
            "Оқыту нәтижелері мен шектеулері",
          )}
        </summary>
        {report && (
          <p>
            {at("Обучение", "Training", "Оқыту")}: {report.trainVideos}{" "}
            {at("видео", "videos", "бейне")}.{" "}
            {at(
              "Тест на других людях",
              "Test on other signers",
              "Басқа адамдардағы сынақ",
            )}
            : {report.testVideos}.{" "}
            {at(
              "Точность на этом тесте",
              "Accuracy on this test",
              "Осы сынақтағы дәлдік",
            )}
            : {(report.accuracy * 100).toFixed(1)}%.{" "}
            {at(
              "Это не точность на вашей камере.",
              "This is not accuracy on your camera.",
              "Бұл сіздің камераңыздағы дәлдік емес.",
            )}
          </p>
        )}
        <a
          href="/research/rsl/alphabet-report.html"
          target="_blank"
          rel="noreferrer"
        >
          {at(
            "Полный отчёт по каждой букве ↗",
            "Full per-letter report ↗",
            "Әр әріптің толық есебі ↗",
          )}
        </a>
      </details>
    </section>
  );
}
