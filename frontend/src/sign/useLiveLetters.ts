import { useEffect, useRef, useState, type RefObject } from "react";
import { drawHandOverlay } from "./handOverlay";
import { appendRecognizedLetter } from "./captions";
import type { TrackingQuality } from "./liveRecognition";

export function useLiveLetters(
  video: RefObject<HTMLVideoElement>,
  canvas: RefObject<HTMLCanvasElement>,
  active: boolean,
) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Загружаем модель букв…");
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [last, setLast] = useState("");
  const worker = useRef<Worker>();
  const busy = useRef(false);
  const session = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    const w = new Worker("/models/rsl/letter-camera-worker.js?v=2");
    worker.current = w;
    const fail = () => {
      busy.current = false;
      setReady(false);
      setStatus(
        "Модель букв не загрузилась. Обновите страницу, чтобы повторить.",
      );
    };
    w.onerror = fail;
    w.onmessage = ({ data }) => {
      if (data.type === "ready") {
        setReady(true);
        setStatus("Буквы готовы");
        return;
      }
      if (data.type === "error") {
        busy.current = false;
        setStatus(data.message);
        return;
      }
      if (data.type !== "frame") return;
      busy.current = false;
      if (data.generation !== session.current || !activeRef.current) return;
      if (video.current && canvas.current)
        drawHandOverlay(canvas.current, video.current, data.detected);
      const tips: Record<TrackingQuality, string> = {
        ready: "Покажите одну букву целиком",
        missing: "Покажите руки в кадре",
        clipped: "Отодвиньте руки от края кадра",
        distant: "Поднесите кисть чуть ближе",
      };
      setStatus(tips[data.quality as TrackingQuality]);
      setProgress(data.progress);
      if (data.accepted) {
        setLast(data.prediction.label);
        setText((v) => appendRecognizedLetter(v, data.prediction));
      } else if (data.prediction?.accepted)
        setStatus(`Возможно, «${data.prediction.label}» — проверяю движение`);
      else if (data.prediction && !data.prediction.accepted)
        setStatus("Буква неясна — повторите движение");
    };
    w.postMessage({ type: "init", origin: location.origin });
    return () => {
      session.current++;
      w.terminate();
      worker.current = undefined;
      busy.current = false;
    };
  }, []);
  useEffect(() => {
    const generation = ++session.current;
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
        now - lastRun < 150
      )
        return;
      lastTime = v.currentTime;
      lastRun = now;
      busy.current = true;
      createImageBitmap(v)
        .then((bitmap) => {
          if (generation !== session.current || !worker.current) {
            bitmap.close();
            busy.current = false;
            return;
          }
          worker.current.postMessage(
            { type: "frame", bitmap, now, generation },
            [bitmap],
          );
        })
        .catch(() => {
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
  return { text, setText, status, progress, last, ready };
}
