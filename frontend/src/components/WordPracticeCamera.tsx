import { useEffect, useRef, useState } from "react";
import { Camera, Square, RotateCcw } from "lucide-react";
import { useLiveLetters } from "../sign/useLiveLetters";
import type { Landmark } from "../sign/phraseCapture";
import type { SeqModel } from "../sign/seqModel";
import type { HandPoint } from "../sign/wordFeatures";
import {
  judgeWord,
  knowsWord,
  loadWordModel,
  recognizeWord,
  WordSegmenter,
  type WordGuess,
} from "../sign/wordRecognizer";
import { at } from "../i18n/automation";
import { cameraHints, type CameraHint } from "../sign/cameraHints";
import "./word-practice.css";

type Attempt = { guess: WordGuess | null; verdict: ReturnType<typeof judgeWord>["verdict"]; hints: CameraHint[] };

/** Camera self-check for one dictionary word. Runs fully in the browser. */
/** choices: the lesson's words — the model then picks among them only
 * (much more reliable than among all course signs). */
export function WordPracticeCamera({ target, choices }: { target: string; choices?: string[] }) {
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const segmenter = useRef(new WordSegmenter());
  const [model, setModel] = useState<SeqModel | null>(null);
  const [modelError, setModelError] = useState(false);
  const [active, setActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    loadWordModel().then(
      (m) => alive && setModel(m),
      () => alive && setModelError(true),
    );
    return () => {
      alive = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    setAttempts([]);
    segmenter.current.reset();
  }, [target]);

  const letters = useLiveLetters(video, overlay, active, (now: number, hands: Landmark[][], pose: Landmark[], face?: number[] | null) => {
    if (!model || !video.current) return;
    const points = hands.filter((h) => h.length === 21).map((h) =>
      h.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })),
    ) as HandPoint[][];
    const clip = segmenter.current.push(now, points, pose, face ?? null);
    setRecording(segmenter.current.recording);
    if (!clip) return;
    const guess = recognizeWord(model, clip, video.current.videoWidth, video.current.videoHeight, true, segmenter.current.clipPoses, segmenter.current.clipFaces, choices);
    const { verdict } = judgeWord(guess, target, !!choices?.length);
    const hints = verdict === "correct" ? [] : cameraHints(clip, segmenter.current.clipPoses, 50);
    setAttempts((list) => [{ guess, verdict, hints }, ...list].slice(0, 5));
  }, "balanced", undefined, 50);

  async function start() {
    setMessage("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
        audio: false,
      });
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      segmenter.current.reset();
      setActive(true);
    } catch (error) {
      setMessage(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? at("Доступ к камере запрещён.", "Camera access denied.", "Камераға рұқсат жоқ.")
          : at("Камера недоступна.", "Camera unavailable.", "Камера қолжетімсіз."),
      );
    }
  }
  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setActive(false);
    setRecording(false);
  }

  if (modelError)
    return <p className="word-practice-note">{at("Модель слов не загрузилась.", "Word model failed to load.", "Сөз моделі жүктелмеді.")}</p>;
  if (model && !knowsWord(model, target))
    return (
      <p className="word-practice-note">
        {at(
          "Для этого жеста камера-проверка пока недоступна.",
          "Camera check is not available for this sign yet.",
          "Бұл ым үшін камерамен тексеру әзірге жоқ.",
        )}
      </p>
    );
  const last = attempts[0];
  const correct = attempts.filter((a) => a.verdict === "correct").length;
  return (
    <section className="word-practice panel" aria-label={at("Проверка жеста камерой", "Camera sign check", "Ымды камерамен тексеру")}>
      <header>
        <h3>{at("Проверить себя", "Check yourself", "Өзіңізді тексеру")}: «{target}»</h3>
        <p>
          {at(
            "Покажите жест и опустите руки.",
            "Sign, then lower your hands.",
            "Ымды көрсетіп, қолды түсіріңіз.",
          )}
        </p>
      </header>
      <div className="word-practice-view" hidden={!active}>
        <video ref={video} playsInline muted />
        <canvas ref={overlay} aria-hidden="true" />
        {recording && <span className="word-practice-rec">{at("Запись жеста…", "Recording sign…", "Ым жазылуда…")}</span>}
      </div>
      <div className="word-practice-actions">
        {!active ? (
          <button className="button primary" disabled={!model} onClick={start}>
            <Camera size={18} />
            {model ? at("Включить камеру", "Start camera", "Камераны қосу") : at("Загружаем модель…", "Loading model…", "Модель жүктелуде…")}
          </button>
        ) : (
          <button className="button secondary" onClick={stop}>
            <Square size={18} />
            {at("Остановить", "Stop", "Тоқтату")}
          </button>
        )}
        {attempts.length > 0 && (
          <button className="button secondary" onClick={() => setAttempts([])}>
            <RotateCcw size={18} />
            {at("Сбросить", "Reset", "Қайта бастау")}
          </button>
        )}
      </div>
      {active && !letters.ready && <p className="word-practice-note">{letters.status}</p>}
      {message && <p className="word-practice-note" role="alert">{message}</p>}
      {last && (
        <div className={`word-practice-result is-${last.verdict}`} role="status" aria-live="polite">
          <strong>
            {last.verdict === "correct"
              ? at("Верно! Жест узнан.", "Correct! Sign recognized.", "Дұрыс! Ым танылды.")
              : last.verdict === "close"
                ? at("Почти: жест похож, повторите чётче.", "Close: similar, repeat more clearly.", "Жақын: анығырақ қайталаңыз.")
                : last.verdict === "unclear"
                  ? at("Руки видны плохо — повторите в кадре.", "Hands unclear — repeat in frame.", "Қол анық емес — қайталаңыз.")
                  : at("Похоже на другой жест.", "Looks like a different sign.", "Басқа ымға ұқсайды.")}
          </strong>
          {last.hints.length > 0 && (
            <ul className="word-practice-hints">
              {last.hints.map((h) => (
                <li key={h.id}>💡 {at(h.ru, h.en, h.kk)}</li>
              ))}
            </ul>
          )}
          {last.guess && (
            <ol>
              {last.guess.top.slice(0, 3).map((t) => (
                <li key={t.label}>
                  {t.label} <span>{Math.round(t.p * 100)}%</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {attempts.length > 0 && (
        <p className="word-practice-score">
          {at("Удачных попыток", "Successful attempts", "Сәтті әрекеттер")}: {correct} / {attempts.length}
        </p>
      )}
    </section>
  );
}
