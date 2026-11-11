import { useEffect, useRef, useState, type RefObject } from "react";
import { drawBodyOverlay } from "./bodyOverlay";
import type { Landmark } from "./phraseCapture";
import { drawHandOverlay } from "./handOverlay";
import { appendRecognizedLetter } from "./captions";
import { LETTER_SAMPLE_MS, type TrackingQuality } from "./liveRecognition";

export function useLiveLetters(
  video: RefObject<HTMLVideoElement>,
  canvas: RefObject<HTMLCanvasElement>,
  active: boolean,
  onTracking?: (now: number, hands: Landmark[][], pose: Landmark[]) => void,
) {
  const trackingCallback = useRef(onTracking);
  trackingCallback.current = onTracking;
  const [bodyStatus, setBodyStatus] = useState(
    "Ориентиры тела появятся после включения камеры",
  );
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Загружаем модель букв…");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryId, setRetryId] = useState(0);
  const [progress, setProgress] = useState(0);
  const [last, setLast] = useState("");
  const worker = useRef<Worker>();
  const busy = useRef(false);
  const session = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    setReady(false);
    setFailed(false);
    setStatus("Загружаем модель букв…");
    let w: Worker;
    let watchdog: ReturnType<typeof setTimeout>;
    const fail = () => {
      clearTimeout(watchdog);
      w?.terminate();
      worker.current = undefined;
      busy.current = false;
      setReady(false);
      setFailed(true);
      setStatus(
        "Модель букв недоступна. Проверьте подключение и повторите загрузку.",
      );
    };
    try {
      w = new Worker("/models/rsl/letter-camera-worker.js?v=5");
    } catch {
      fail();
      return;
    }
    worker.current = w;
    watchdog = setTimeout(fail, 60000);
    w.onerror = fail;
    w.onmessageerror = fail;
    w.onmessage = ({ data }) => {
      if (worker.current !== w) return;
      if (data.type === "ready") {
        clearTimeout(watchdog);
        setReady(true);
        setStatus("Буквы готовы");
        return;
      }
      if (data.type === "body-error") {
        setBodyStatus(
          "Ориентиры тела недоступны. Автоматическое завершение фразы может не работать; используйте кнопку завершения записи.",
        );
        return;
      }
      if (data.type === "error") {
        if (data.fatal) {
          fail();
          return;
        }
        if (data.generation !== session.current || !activeRef.current) return;
        busy.current = false;
        setStatus(data.message);
        return;
      }
      if (data.type !== "frame") return;
      if (data.generation !== session.current || !activeRef.current) return;
      busy.current = false;
      if (video.current && canvas.current) {
        drawHandOverlay(canvas.current, video.current, data.detected);
        drawBodyOverlay(canvas.current, data.pose ?? []);
      }
      const body = (data.pose ?? []) as Landmark[];
      const seen = (i: number) => body[i] && (body[i].visibility ?? 0) > 0.6;
      if (data.bodyAvailable)
        setBodyStatus(
          [11, 12, 13, 14].every(seen)
            ? "Плечи и локти видны"
            : "Отойдите немного: нужны плечи и локти в кадре",
        );
      const slots = ["Left", "Right"].map((side) => {
        const index = data.detected.handedness.findIndex(
          (h: { categoryName: string }[]) => h[0]?.categoryName === side,
        );
        return index < 0 ? [] : data.detected.landmarks[index];
      });
      trackingCallback.current?.(performance.now(), slots, body);
      const tips: Record<TrackingQuality, string> = {
        ready: "Покажите одну букву целиком",
        missing: "Покажите руки в кадре",
        clipped: "Отодвиньте руки от края кадра",
        distant: "Поднесите кисть чуть ближе",
      };
      if (data.quality !== "ready" || data.progress < 100)
        setStatus(tips[data.quality as TrackingQuality]);
      setProgress(data.progress);
      if (data.accepted) {
        setStatus(`Добавлена буква «${data.prediction.label}»`);
        setLast(data.prediction.label);
        setText((v) => appendRecognizedLetter(v, data.prediction));
      } else if (data.prediction?.accepted)
        setStatus(`Возможно, «${data.prediction.label}» — проверяю движение`);
      else if (data.disagreement)
        setStatus(
          "Модели не согласны — буква не добавлена. Покажите её отдельно и целиком.",
        );
      else if (data.prediction && !data.prediction.accepted)
        setStatus("Буква неясна — повторите движение");
    };
    w.postMessage({ type: "init", origin: location.origin });
    return () => {
      clearTimeout(watchdog);
      session.current++;
      w.terminate();
      worker.current = undefined;
      busy.current = false;
    };
  }, [retryId]);
  useEffect(() => {
    const generation = ++session.current;
    busy.current = false;
    worker.current?.postMessage({ type: "reset" });
    setProgress(0);
    if (!active || !ready) {
      if (canvas.current)
        canvas.current
          .getContext("2d")
          ?.clearRect(0, 0, canvas.current.width, canvas.current.height);
      return;
    }
    let raf = 0,
      lastTime = -1,
      lastRun = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const v = video.current;
      if (
        document.hidden ||
        busy.current ||
        !v ||
        v.readyState < 2 ||
        v.currentTime === lastTime ||
        now - lastRun < LETTER_SAMPLE_MS
      )
        return;
      lastTime = v.currentTime;
      lastRun = now;
      busy.current = true;
      createImageBitmap(v)
        .then((bitmap) => {
          if (generation !== session.current || !worker.current) {
            bitmap.close();
            return;
          }
          worker.current.postMessage(
            { type: "frame", bitmap, now, generation },
            [bitmap],
          );
        })
        .catch(() => {
          if (generation !== session.current) return;
          busy.current = false;
          setStatus("Не удалось получить кадр камеры.");
        });
    };
    raf = requestAnimationFrame(tick);
    return () => {
      session.current++;
      cancelAnimationFrame(raf);
    };
  }, [active, ready]);
  return {
    text,
    setText,
    status,
    progress,
    last,
    ready,
    failed,
    retry: () => setRetryId((value) => value + 1),
    bodyStatus,
  };
}
