import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Camera, CameraOff, Check } from "lucide-react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { at } from "../i18n/automation";
import { faceRow } from "../sign/wordFeatures";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./fingerspell.css";
import "./course.css";

/** Facial grammar trainer: MediaPipe Face Landmarker in the browser checks the
 * non-manual markers RSL grammar uses. Measured relative to the learner's own
 * calm face (2 s calibration), so personal features do not matter. */
type TaskId = "yesno" | "wh" | "neg" | "nod";
const TASKS = (): { id: TaskId; title: string; how: string; example: string }[] => [
  { id: "yesno", title: at("Вопрос «да/нет»", "Yes/no question", "Иә/жоқ сұрағы"), how: at("Поднимите брови и задержите на секунду.", "Raise your eyebrows and hold for a second.", "Қасты көтеріңіз."), example: "ТЫ ГЛУХОЙ? — брови вверх, голова чуть вперёд" },
  { id: "wh", title: at("Вопрос со словом", "Wh-question", "Сұрақ сөзімен"), how: at("Сведите (нахмурьте) брови и задержите на секунду.", "Furrow your brows and hold for a second.", "Қасты түйіңіз."), example: "ТЫ ИМЯ КТО? — брови сведены, слово-вопрос в конце" },
  { id: "neg", title: at("Отрицание", "Negation", "Болымсыздық"), how: at("Покачайте головой из стороны в сторону 2–3 раза.", "Shake your head 2–3 times.", "Басты шайқаңыз."), example: "Я НЕ ПОНЯТЬ — с покачиванием головой" },
  { id: "nod", title: at("Согласие", "Affirmation", "Келісу"), how: at("Кивните 2–3 раза.", "Nod 2–3 times.", "Бас изеңіз."), example: "ДА, Я ХОТЕТЬ — с кивком" },
];
// faceRow indices
const BROW_UP = [0, 2], BROW_DOWN = 1, YAW = 17, PITCH = 18;

export function FaceTrainerPage() {
  const video = useRef<HTMLVideoElement>(null);
  const landmarker = useRef<FaceLandmarker | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "calibrating" | "ready" | "error">("idle");
  const [task, setTask] = useState<TaskId>("yesno");
  const [done, setDone] = useState<Record<TaskId, boolean>>({ yesno: false, wh: false, neg: false, nod: false });
  const [meters, setMeters] = useState({ up: 0, down: 0, shake: 0, nod: 0, face: false });
  const taskRef = useRef(task);
  taskRef.current = task;

  async function start() {
    setState("loading");
    try {
      const files = await FilesetResolver.forVisionTasks(`${location.origin}/models/rsl/wasm`);
      landmarker.current = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${location.origin}/models/rsl/face_landmarker.task`, delegate: "CPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      });
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      video.current!.srcObject = stream.current;
      await video.current!.play();
      setState("calibrating");
    } catch {
      setState("error");
    }
  }
  useEffect(() => {
    if (state !== "calibrating" && state !== "ready") return;
    let raf = 0, last = 0, alive = true;
    const base: number[][] = [];
    const t0 = performance.now();
    let baseline: number[] | null = null;
    let hold = 0;
    const hist: { t: number; yaw: number; pitch: number }[] = [];
    const loop = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      const v = video.current, lm = landmarker.current;
      if (!v || !lm || v.readyState < 2 || now - last < 66) return;
      const dt = now - last;
      last = now;
      const r = lm.detectForVideo(v, now);
      const blend = r.faceBlendshapes?.[0]?.categories;
      if (!blend || !r.faceLandmarks?.[0]) {
        setMeters((m) => ({ ...m, face: false }));
        return;
      }
      const row = faceRow(Object.fromEntries(blend.map((c) => [c.categoryName, c.score])), r.faceLandmarks[0], v.videoWidth, v.videoHeight);
      if (!baseline) {
        base.push(row);
        if (now - t0 > 2000 && base.length > 10) {
          baseline = row.map((_, k) => base.reduce((a, b) => a + b[k], 0) / base.length);
          setState("ready");
        }
        setMeters((m) => ({ ...m, face: true }));
        return;
      }
      const up = Math.max(0, (row[BROW_UP[0]] + row[BROW_UP[1]]) / 2 - (baseline[BROW_UP[0]] + baseline[BROW_UP[1]]) / 2);
      const down = Math.max(0, row[BROW_DOWN] - baseline[BROW_DOWN]);
      hist.push({ t: now, yaw: row[YAW] - baseline[YAW], pitch: row[PITCH] - baseline[PITCH] });
      while (hist.length && now - hist[0].t > 2000) hist.shift();
      // head shake / nod: number of direction reversals with enough amplitude in the last 2 s
      const swings = (key: "yaw" | "pitch", amp: number) => {
        let n = 0, dir = 0, ext = hist[0]?.[key] ?? 0;
        for (const h of hist) {
          const d = h[key] - ext;
          if (dir >= 0 && d < -amp) { n++; dir = -1; ext = h[key]; }
          else if (dir <= 0 && d > amp) { n++; dir = 1; ext = h[key]; }
          else if ((dir > 0 && h[key] > ext) || (dir < 0 && h[key] < ext)) ext = h[key];
        }
        return n;
      };
      const shake = swings("yaw", 0.12), nod = swings("pitch", 0.08);
      setMeters({ up, down, shake, nod, face: true });
      const t = taskRef.current;
      const ok = t === "yesno" ? up > 0.18 && down < 0.15 : t === "wh" ? down > 0.15 && up < 0.12 : t === "neg" ? shake >= 3 : nod >= 3;
      hold = ok ? hold + dt : 0;
      if (hold > (t === "yesno" || t === "wh" ? 700 : 1)) setDone((d) => (d[t] ? d : { ...d, [t]: true }));
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [state === "calibrating" || state === "ready"]);
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);
  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setState("idle");
  }

  const cur = TASKS().find((t) => t.id === task)!;
  const bar = (v: number, max: number) => <i style={{ width: `${Math.min(100, (v / max) * 100)}%` }} />;
  return (
    <div className="sign-workspace vocab fingerspell course">
      <Link className="text-link back-link" to="/grammar?track=rsl&lesson=face">
        <ArrowLeft size={16} /> {at("Урок «Лицо и тело»", "Lesson “Face and body”", "«Бет пен дене» сабағы")}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{at("ТРЕНАЖЁР · ИИ", "TRAINER · AI", "ЖАТТЫҒУ · ЖИ")}</span>
          <h1>{at("Мимика — это грамматика", "The face is grammar", "Мимика — грамматика")}</h1>
          <p>{at("В РЖЯ одна и та же фраза становится вопросом или отрицанием благодаря лицу и голове. ИИ проверит ваши выражения в камере.", "The face and head turn a phrase into a question or a negation. AI checks your expressions.", "Бет пен бас сөйлемді сұраққа айналдырады.")}</p>
        </div>
      </div>
      <div className="fs-round">
        <section className="panel fs-player">
          <video ref={video} className="test-video face-mirror" muted playsInline />
          {state === "idle" && (
            <button className="button primary" onClick={start}>
              <Camera size={18} /> {at("Включить камеру", "Turn on camera", "Камераны қосу")}
            </button>
          )}
          {state === "loading" && <p>{at("Загружаем модель лица…", "Loading the face model…", "Жүктелуде…")}</p>}
          {state === "calibrating" && (
            <p className="fs-tip">
              {meters.face
                ? at("Смотрите в камеру со спокойным лицом 2 секунды…", "Look at the camera with a calm face for 2 seconds…", "2 секунд тыныш қараңыз…")
                : at("Лицо не видно — сядьте напротив камеры, при хорошем свете.", "Face not visible — sit facing the camera in good light.", "Бет көрінбейді.")}
            </p>
          )}
          {state === "calibrating" && (
            <button className="button secondary" onClick={stop}><CameraOff size={16} /> {at("Выключить камеру", "Turn off camera", "Камераны өшіру")}</button>
          )}
          {state === "error" && <p className="translate-status error">{at("Камера недоступна. Откройте сайт в Chrome и разрешите камеру.", "Camera unavailable. Use Chrome and allow the camera.", "Камера қолжетімсіз.")}</p>}
          {state === "ready" && (
            <div className="face-meters">
              <label>{at("Брови вверх", "Brows up", "Қас жоғары")}<span>{bar(meters.up, 0.3)}</span></label>
              <label>{at("Брови сведены", "Brows down", "Қас түйілген")}<span>{bar(meters.down, 0.25)}</span></label>
              <label>{at("Покачивание", "Head shake", "Шайқау")}<span>{bar(meters.shake, 3)}</span></label>
              <label>{at("Кивок", "Nod", "Изеу")}<span>{bar(meters.nod, 3)}</span></label>
              {!meters.face && <p className="fs-tip">{at("Лицо не видно — сядьте ближе к камере.", "Face not visible — come closer.", "Бет көрінбейді.")}</p>}
              <button className="button secondary" onClick={stop}><CameraOff size={16} /> {at("Выключить камеру", "Turn off camera", "Камераны өшіру")}</button>
            </div>
          )}
        </section>
        <section className="panel fs-answer">
          <div className="vocab-chips">
            {TASKS().map((t) => (
              <button key={t.id} aria-pressed={t.id === task} onClick={() => setTask(t.id)}>
                {done[t.id] ? "✓ " : ""}{t.title}
              </button>
            ))}
          </div>
          <h2>{cur.title}</h2>
          <p>{cur.how}</p>
          <p className="grammar-example"><span>{cur.example}</span></p>
          {done[task] ? (
            <p className="vocab-feedback ok"><Check size={18} /> {at("Получилось!", "Done!", "Шықты!")}</p>
          ) : (
            state === "ready" && <p className="fs-tip">{at("Повторяйте, пока не появится «Получилось».", "Keep trying until it says done.", "Қайталаңыз.")}</p>
          )}
          <p className="fs-progress">{at("Выполнено", "Completed", "Орындалды")}: {Object.values(done).filter(Boolean).length} / 4</p>
          <p className="fs-tip">
            {at(
              "Камера и распознавание работают только в браузере. ИИ проверяет движение бровей и головы, а не правильность всей фразы.",
              "Everything runs in your browser. AI checks brows and head movement, not the whole phrase.",
              "Барлығы браузерде жұмыс істейді.",
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
