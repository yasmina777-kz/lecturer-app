import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Camera, CameraOff, Check, Download, Hand, Info, Scale, Type } from "lucide-react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { at } from "../i18n/automation";
import { alphabetIllustration } from "../sign/alphabetIllustrations";
import {
  KAZAKH_LETTERS,
  KAZAKH_ONLY,
  KSL_N,
  classifySilhouette,
  handPoints,
  loadKslModel,
  renderSilhouette,
  type KslModel,
} from "../sign/kslSilhouette";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./fingerspell.css";
import "./course.css";
import "./kazakh-sign.css";

type Tab = "alphabet" | "trainer" | "why" | "analogs";
const ref = (c: string) => `/models/ksl/ref/${c.codePointAt(0)!.toString(16).padStart(4, "0")}.png`;
const SAMPLES = "ksl-letter-samples-v1";

type Report = {
  transfer_qazsl_only_letters?: { top1: number; top3: number };
  letters_with_camera_data?: { top1: number; top3: number };
  final?: { bukva_test_signers_top1: number; qazsl_heldout_kazakh9_top1: number };
};

export function KazakhSignPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "alphabet";
  const tabs: { id: Tab; label: string; icon: typeof Hand }[] = [
    { id: "alphabet", label: at("Алфавит · 42 буквы", "Alphabet · 42 letters", "Әліпби · 42 әріп"), icon: Type },
    { id: "trainer", label: at("Тренажёр с камерой", "Camera trainer", "Камерамен жаттығу"), icon: Camera },
    { id: "why", label: at("РЖЯ и казахский ЖЯ", "RSL and Kazakh SL", "ОЫТ және қазақ ЫТ"), icon: Info },
    { id: "analogs", label: at("Аналоги", "Alternatives", "Аналогтар"), icon: Scale },
  ];
  return (
    <div className="sign-workspace vocab fingerspell course ksl-page">
      <Link className="text-link back-link" to="/course">
        <ArrowLeft size={16} /> {at("Курс", "Course", "Курс")}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{at("КАЗАХСТАН · ДАКТИЛЬ", "KAZAKHSTAN · FINGERSPELLING", "ҚАЗАҚСТАН · ДАКТИЛЬ")}</span>
          <h1>{at("Казахский жестовый язык", "Kazakh Sign Language", "Қазақ ым тілі")}</h1>
          <p>
            {at(
              "Казахский дактиль — 42 буквы: 33 общие с русским и 9 букв казахского алфавита. Учите их и проверяйте себя камерой — распознавание работает прямо в браузере.",
              "Kazakh fingerspelling has 42 letters: 33 shared with Russian and 9 Kazakh ones. Learn them and check yourself with the camera — recognition runs in the browser.",
              "Қазақ дактилінде 42 әріп бар: 33-і орыс тілімен ортақ, 9-ы қазақ әріптері. Үйреніп, камерамен тексеріңіз — тану браузерде жұмыс істейді.",
            )}
          </p>
        </div>
      </div>
      <div className="ksl-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => setParams({ tab: t.id })}>
            <t.icon size={17} /> {t.label}
          </button>
        ))}
      </div>
      {tab === "alphabet" && <Alphabet onPractice={(l) => setParams({ tab: "trainer", letter: l })} />}
      {tab === "trainer" && <Trainer initial={params.get("letter") ?? "Ә"} />}
      {tab === "why" && <Why />}
      {tab === "analogs" && <Analogs />}
      <p className="fs-credit">
        {at("Данные: ", "Data: ", "Деректер: ")}
        <a href="https://zenodo.org/records/22830162" target="_blank" rel="noreferrer">QazSL</a> (Beisov, Jotsov, Kerimbayev, CC BY 4.0) ·{" "}
        <a href="https://github.com/ai-forever/bukva" target="_blank" rel="noreferrer">Bukva</a> (ai-forever) · MediaPipe (Google, Apache 2.0).{" "}
        <a href="/models/ksl/ATTRIBUTION.txt" target="_blank" rel="noreferrer">{at("Лицензии", "Licences", "Лицензиялар")}</a>
      </p>
    </div>
  );
}

function Alphabet({ onPractice }: { onPractice: (l: string) => void }) {
  const [pick, setPick] = useState("Ә");
  const kz = KAZAKH_ONLY.includes(pick);
  const img = kz ? ref(pick) : alphabetIllustration(pick);
  return (
    <div className="ksl-alphabet">
      <section className="panel ksl-grid-panel">
        <p className="ksl-legend">
          <span className="ksl-dot kz" /> {at("9 казахских букв", "9 Kazakh letters", "9 қазақ әрпі")}
          <span className="ksl-dot" /> {at("33 общие с русским дактилем", "33 shared with Russian", "Орыс дактилімен ортақ 33 әріп")}
        </p>
        <div className="ksl-grid">
          {KAZAKH_LETTERS.map((l) => (
            <button key={l} className={`${KAZAKH_ONLY.includes(l) ? "kz" : ""} ${pick === l ? "on" : ""}`} onClick={() => setPick(l)}>
              {l}
            </button>
          ))}
        </div>
      </section>
      <section className="panel ksl-letter">
        <span className="ksl-big">{pick}</span>
        {img ? <img className={kz ? "ksl-sil" : ""} src={img} alt={pick} /> : <p>{at("Для Ё нет рисунка: покажите Е и встряхните кисть.", "No picture for Ё.", "Ё үшін сурет жоқ.")}</p>}
        <p className="ksl-note">
          {kz
            ? at(
                "Силуэт кисти из открытого датасета QazSL — так букву показывают носители казахского дактиля. Часть букв показывается с движением: на силуэте виден только конечный момент.",
                "Hand silhouette from the open QazSL dataset. Some letters include a movement; the silhouette shows one moment.",
                "QazSL ашық деректер жинағындағы қол силуэті. Кейбір әріптер қимылмен көрсетіледі.",
              )
            : at("Эта буква показывается так же, как в русском дактиле.", "Shown the same as in Russian fingerspelling.", "Бұл әріп орыс дактиліндегідей көрсетіледі.")}
        </p>
        <button className="button primary" onClick={() => onPractice(pick)}>
          <Camera size={18} /> {at("Проверить камерой", "Check with camera", "Камерамен тексеру")}
        </button>
      </section>
    </div>
  );
}

function Trainer({ initial }: { initial: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const sil = useRef<HTMLCanvasElement>(null);
  const lm = useRef<HandLandmarker | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const model = useRef<KslModel | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "on" | "error">("idle");
  const [target, setTarget] = useState(KAZAKH_LETTERS.includes(initial) ? initial : "Ә");
  const [top, setTop] = useState<{ l: string; p: number }[]>([]);
  const [hand, setHand] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [report, setReport] = useState<Report | null>(null);
  const [recording, setRecording] = useState(false);
  const [samples, setSamples] = useState<Record<string, number>>(() => {
    try {
      const all = JSON.parse(localStorage.getItem(SAMPLES) ?? "[]") as { label: string }[];
      return all.reduce<Record<string, number>>((a, s) => ({ ...a, [s.label]: (a[s.label] ?? 0) + 1 }), {});
    } catch {
      return {};
    }
  });
  const targetRef = useRef(target);
  targetRef.current = target;
  const recRef = useRef(recording);
  recRef.current = recording;

  useEffect(() => {
    loadKslModel().then((m) => setReport((m.report as Report) ?? null)).catch(() => undefined);
  }, []);

  async function start() {
    setState("loading");
    try {
      const [files, m] = await Promise.all([FilesetResolver.forVisionTasks(`${location.origin}/models/rsl/wasm`), loadKslModel()]);
      model.current = m;
      lm.current = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${location.origin}/models/rsl/hand_landmarker.task`, delegate: "CPU" },
        runningMode: "VIDEO",
        numHands: 1,
      });
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      video.current!.srcObject = stream.current;
      await video.current!.play();
      setState("on");
    } catch {
      setState("error");
    }
  }
  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setState("idle");
    setRecording(false);
  }
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  useEffect(() => {
    if (state !== "on") return;
    let raf = 0, last = 0, alive = true, streak = 0;
    const loop = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      const v = video.current, det = lm.current, m = model.current;
      if (!v || !det || !m || v.readyState < 2 || now - last < 100) return;
      last = now;
      const r = det.detectForVideo(v, now);
      const world = r.worldLandmarks?.[0];
      const ctx = sil.current?.getContext("2d");
      if (!world) {
        setHand(false);
        setTop([]);
        streak = 0;
        ctx?.clearRect(0, 0, KSL_N, KSL_N);
        return;
      }
      setHand(true);
      const side = r.handedness?.[0]?.[0]?.categoryName ?? "Right";
      const pts = handPoints(world, side);
      const img = renderSilhouette(pts);
      if (ctx) {
        const data = ctx.createImageData(KSL_N, KSL_N);
        img.forEach((v, i) => {
          data.data.set(v ? [246, 196, 92, 255] : [20, 24, 28, 255], i * 4);
        });
        ctx.putImageData(data, 0, 0);
      }
      if (recRef.current) {
        try {
          const all = JSON.parse(localStorage.getItem(SAMPLES) ?? "[]");
          all.push({ label: targetRef.current, side, at: Date.now(), points: world.map((q) => [+q.x.toFixed(5), +q.y.toFixed(5), +q.z.toFixed(5)]) });
          localStorage.setItem(SAMPLES, JSON.stringify(all.slice(-4000)));
          setSamples((s) => ({ ...s, [targetRef.current]: (s[targetRef.current] ?? 0) + 1 }));
        } catch {
          setRecording(false);
        }
      }
      const probs = classifySilhouette(m, img);
      const letters = probs
        .map((p, k) => ({ l: m.labels[k], p }))
        .filter((x) => KAZAKH_LETTERS.includes(x.l))
        .sort((a, b) => b.p - a.p)
        .slice(0, 3);
      setTop(letters);
      const ok = letters[0]?.l === targetRef.current && letters[0].p >= 0.35;
      streak = ok ? streak + 1 : 0;
      if (streak >= 5) setDone((d) => (d[targetRef.current] ? d : { ...d, [targetRef.current]: true }));
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [state]);

  function exportSamples() {
    const blob = new Blob([localStorage.getItem(SAMPLES) ?? "[]"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ksl-letter-samples-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const kz = KAZAKH_ONLY.includes(target);
  const pct = (v?: number) => (v === undefined ? "—" : `${Math.round(v * 100)}%`);
  const img = kz ? ref(target) : alphabetIllustration(target);
  return (
    <div className="ksl-trainer">
      <section className="panel fs-player">
        <div className="cam-frame">
          <video ref={video} className="test-video face-mirror" muted playsInline />
          {state !== "on" && (
            <div className="cam-off">
              <CameraOff size={34} />
              <span>{state === "error" ? at("Камера или модель недоступна", "Camera or model unavailable", "Камера қолжетімсіз") : at("Камера выключена", "Camera is off", "Камера өшірулі")}</span>
            </div>
          )}
          {state === "on" && (
            <div className="ksl-sil-live" title={at("Так руку видит модель", "What the model sees", "Модель көретін пішін")}>
              <canvas ref={sil} width={KSL_N} height={KSL_N} />
              <span>{at("видит модель", "model view", "модель")}</span>
            </div>
          )}
        </div>
        {state === "idle" || state === "error" ? (
          <button className="button primary" onClick={start}>
            <Camera size={18} /> {at("Включить камеру", "Turn on camera", "Камераны қосу")}
          </button>
        ) : state === "loading" ? (
          <p>{at("Загружаем модели…", "Loading models…", "Жүктелуде…")}</p>
        ) : (
          <div className="ksl-cam-actions">
            <button className="button" onClick={stop}>
              <CameraOff size={18} /> {at("Выключить", "Turn off", "Өшіру")}
            </button>
            <button className={`button ${recording ? "danger" : ""}`} onClick={() => setRecording((r) => !r)}>
              {recording ? at("Остановить запись", "Stop recording", "Жазуды тоқтату") : at(`Записать пример «${target}»`, `Record “${target}”`, `«${target}» үлгісін жазу`)}
            </button>
          </div>
        )}
        <p className="fs-tip">
          {at(
            "Покажите одну руку целиком на однотонном фоне. Видео никуда не отправляется: точки кисти считаются в браузере.",
            "Show one whole hand. Video never leaves the browser.",
            "Бір қолды толық көрсетіңіз. Бейне браузерден шықпайды.",
          )}
        </p>
      </section>
      <section className="panel fs-answer">
        <div className="ksl-target">
          <span className={`ksl-big ${done[target] ? "ok" : ""}`}>{target}</span>
          {img && <img className={kz ? "ksl-sil" : ""} src={img} alt="" />}
        </div>
        {done[target] ? (
          <p className="vocab-feedback ok"><Check size={18} /> {at("Получилось!", "Got it!", "Дұрыс!")}</p>
        ) : (
          <p className="ksl-status">{state !== "on" ? at("Включите камеру и покажите букву", "Turn on the camera and show the letter", "Камераны қосып, әріпті көрсетіңіз") : hand ? at("Держите форму кисти…", "Hold the hand shape…", "Қол пішінін ұстаңыз…") : at("Рука не найдена", "No hand found", "Қол табылмады")}</p>
        )}
        <ol className="ksl-top">
          {top.map((t) => (
            <li key={t.l} className={t.l === target ? "hit" : ""}>
              <b>{t.l}</b>
              <i style={{ width: `${Math.round(t.p * 100)}%` }} />
              <span>{Math.round(t.p * 100)}%</span>
            </li>
          ))}
        </ol>
        {kz && (
          <p className="ksl-warn">
            {at(
              "Для 9 казахских букв у модели пока есть только силуэты QazSL, а не записи с камеры. Для этих букв проверка экспериментальная.",
              "For the 9 Kazakh letters the model has only QazSL silhouettes, not camera recordings, so checking them is experimental.",
              "9 қазақ әрпі үшін модельде тек QazSL силуэттері бар, сондықтан тексеру тәжірибелік.",
            )}
          </p>
        )}
        <div className="ksl-grid small">
          {KAZAKH_LETTERS.map((l) => (
            <button key={l} className={`${KAZAKH_ONLY.includes(l) ? "kz" : ""} ${target === l ? "on" : ""} ${done[l] ? "done" : ""}`} onClick={() => setTarget(l)}>
              {l}
              {samples[l] ? <small>{samples[l]}</small> : null}
            </button>
          ))}
        </div>
        {Object.keys(samples).length > 0 && (
          <button className="ar-download text-link" onClick={exportSamples}>
            <Download size={16} /> {at("Скачать записанные примеры (только точки кисти)", "Download recorded samples (hand points only)", "Жазылған үлгілерді жүктеу")}
          </button>
        )}
        {report && (
          <details className="ksl-report">
            <summary>{at("Точность модели (честно)", "Model accuracy", "Модель дәлдігі")}</summary>
            <ul>
              <li>{at("33 общие буквы, новые люди, которых не было в обучении (Bukva):", "33 shared letters, unseen signers (Bukva):", "33 ортақ әріп, жаңа адамдар:")} <b>{pct(report.final?.bukva_test_signers_top1)}</b></li>
              <li>{at("9 казахских букв на отложенной части QazSL (силуэты):", "9 Kazakh letters, held-out QazSL silhouettes:", "9 қазақ әрпі, QazSL:")} <b>{pct(report.final?.qazsl_heldout_kazakh9_top1)}</b></li>
              <li>{at("Перенос с силуэтов QazSL на камеру (буквы без записей с камеры):", "Transfer from QazSL silhouettes to the camera:", "QazSL-ден камераға тасымалдау:")} <b>{pct(report.transfer_qazsl_only_letters?.top1)}</b></li>
            </ul>
            <p>{at("Последняя цифра — ожидаемая точность казахских букв с камеры. Чтобы её поднять, нужны записи с камеры: кнопка «Записать пример» сохраняет только точки кисти в этом браузере.", "The last figure estimates camera accuracy for Kazakh letters. Recording samples improves it.", "Соңғы сан — камерадағы қазақ әріптерінің күтілетін дәлдігі.")}</p>
          </details>
        )}
      </section>
    </div>
  );
}

function Why() {
  const points = useMemo(
    () => [
      {
        t: at("Жестовый язык не равен устному", "A sign language is not the spoken one", "Ым тілі ауызша тілге тең емес"),
        d: at(
          "Глухие Казахстана общаются на жестовом языке, который исследователи Назарбаев Университета называют казахско-русским (K-RSL). Он близкородственен русскому жестовому языку: общая советская школа сурдопедагогики, много общих жестов, есть региональные отличия. Поэтому выученный РЖЯ понятен глухим в Казахстане, а казахский дактиль и местные жесты добавляются к нему.",
          "Deaf people in Kazakhstan use a sign language that Nazarbayev University researchers call Kazakh-Russian Sign Language (K-RSL). It is closely related to Russian Sign Language, with many shared signs and regional differences.",
          "Қазақстандағы керең адамдар Назарбаев Университетінің зерттеушілері қазақ-орыс ым тілі (K-RSL) деп атайтын тілде сөйлеседі. Ол орыс ым тілімен туыстас, ортақ ымдар көп.",
        ),
      },
      {
        t: at("Главное отличие — дактиль", "The main difference is fingerspelling", "Басты айырмашылық — дактиль"),
        d: at(
          "Казахская дактильная азбука (впервые опубликована в 1998 году) содержит 42 буквы: 33 совпадают с русским дактилем, 9 — Ә, Ғ, Қ, Ң, Ө, Ұ, Ү, Һ, І — свои. Именно их мы добавили: алфавит, силуэты и тренажёр с камерой.",
          "The Kazakh manual alphabet (first published in 1998) has 42 letters: 33 as in Russian plus Ә, Ғ, Қ, Ң, Ө, Ұ, Ү, Һ, І.",
          "Қазақ дактиль әліпбиі (алғаш 1998 жылы жарияланған) 42 әріптен тұрады: 33-і орыс дактилімен бірдей, 9-ы өзіндік.",
        ),
      },
      {
        t: at("Почему начали с РЖЯ", "Why we started with RSL", "Неге ОЫТ-тан бастадық"),
        d: at(
          "Для РЖЯ есть крупные открытые наборы данных: Slovo — 20 400 видео 1000 жестов, Bukva — более 3 700 видео букв. На них мы обучили распознавание слов и букв. Для казахского ЖЯ открытых видеонаборов такого размера нет: QazSL (2026) — это 105 600 силуэтов кисти, а не видео. Его мы и использовали.",
          "RSL has large open datasets (Slovo: 20,400 videos of 1,000 signs; Bukva: 3,700+ letter videos). Kazakh SL has no open video set of that size; QazSL (2026) has 105,600 hand silhouettes, which we used.",
          "ОЫТ үшін үлкен ашық деректер бар: Slovo — 1000 ымның 20 400 бейнесі, Bukva — әріптердің 3 700-ден астам бейнесі. Қазақ ЫТ үшін QazSL (2026) — 105 600 қол силуэті.",
        ),
      },
      {
        t: at("Интерфейс на трёх языках", "Three interface languages", "Үш тілді интерфейс"),
        d: at(
          "Весь сайт доступен на казахском, русском и английском, а курс, тренажёры и культура глухих — с переводом подсказок.",
          "The whole site is available in Kazakh, Russian and English.",
          "Бүкіл сайт қазақ, орыс және ағылшын тілдерінде қолжетімді.",
        ),
      },
    ],
    [],
  );
  return (
    <div className="culture-sections">
      {points.map((p) => (
        <section key={p.t} className="panel culture-section">
          <h2>{p.t}</h2>
          <p>{p.d}</p>
        </section>
      ))}
    </div>
  );
}

const ANALOGS = () => [
  {
    name: "е-Ымдау",
    who: at("ННПЦ развития специального и инклюзивного образования, МП РК", "National centre for special and inclusive education, Kazakhstan", "ҚР ОМ арнайы және инклюзивті білім беру ұлттық орталығы"),
    what: at("Видеословарь казахстанского ЖЯ: 21 тема, поиск на казахском и русском, iOS и сайт", "Video dictionary: 21 topics, KZ/RU search, iOS and web", "Бейнесөздік: 21 тақырып, ҚАЗ/ОРЫС іздеу"),
    cam: false, course: false, kz: true,
    url: "https://www.kazpravda.kz/n/videoslovar-zhestovogo-yazyka-zapustili-v-kazahstane",
  },
  {
    name: "AI-Ym",
    who: at("Дипломный проект Назарбаев Университета, 2025", "Nazarbayev University capstone, 2025", "Назарбаев Университетінің дипломдық жобасы, 2025"),
    what: at("Курсы и словарь K-RSL, оценка жеста по камере (MediaPipe + DTW со эталоном), XP и серии", "K-RSL courses and dictionary, camera scoring against a reference (MediaPipe + DTW)", "K-RSL курстары мен сөздігі, камерамен бағалау"),
    cam: true, course: true, kz: true,
    url: "https://nur.nu.edu.kz/items/0e5d9654-3a94-4ed1-bff1-1ffb35f261f0",
  },
  {
    name: "Qoldas",
    who: at("Открытый проект на GitHub (Flutter)", "Open-source Flutter app", "GitHub ашық жобасы"),
    what: at("Мобильные видеоуроки казахского ЖЯ, тесты, прогресс", "Mobile video lessons, quizzes, progress", "Бейнесабақтар, тесттер, прогресс"),
    cam: false, course: true, kz: true,
    url: "https://github.com/DamirBai/qoldas",
  },
  {
    name: "QazSL",
    who: at("Исследование Beisov, Jotsov, Kerimbayev, 2026", "Research by Beisov, Jotsov, Kerimbayev, 2026", "Beisov, Jotsov, Kerimbayev зерттеуі, 2026"),
    what: at("Открытый датасет 42 букв казахского дактиля (силуэты) и модель распознавания одного кадра — не обучающая платформа", "Open dataset of 42 Kazakh letters (silhouettes) and a single-frame model — not a learning platform", "42 әріптің ашық деректер жинағы, оқыту платформасы емес"),
    cam: true, course: false, kz: true,
    url: "https://zenodo.org/records/22830162",
  },
  {
    name: "Spread the Sign",
    who: at("Международный словарь (Швеция)", "International dictionary (Sweden)", "Халықаралық сөздік"),
    what: at("Видео жестов многих стран, в том числе русского ЖЯ; курса и проверки камерой нет", "Sign videos from many countries incl. RSL; no course or camera check", "Көп елдің ымдары; курс жоқ"),
    cam: false, course: false, kz: false,
    url: "https://www.spreadthesign.com",
  },
  {
    name: "Slovo / Bukva",
    who: at("SberDevices (ai-forever), 2023–2024", "SberDevices (ai-forever), 2023–2024", "SberDevices, 2023–2024"),
    what: at("Открытые датасеты РЖЯ (1000 жестов, 33 буквы) и модели — для исследователей, не для учеников", "Open RSL datasets and models for researchers, not learners", "Зерттеушілерге арналған ОЫТ деректері"),
    cam: true, course: false, kz: false,
    url: "https://github.com/ai-forever/bukva",
  },
];

function Analogs() {
  const yes = <Check size={17} className="ksl-yes" />;
  const no = <span className="ksl-no">—</span>;
  return (
    <div className="ksl-analogs">
      <section className="panel">
        <h2>{at("Что уже есть и чем мы отличаемся", "What exists and how we differ", "Не бар және біз немен ерекшеленеміз")}</h2>
        <div className="ksl-table-wrap">
          <table className="ksl-table">
            <thead>
              <tr>
                <th>{at("Решение", "Solution", "Шешім")}</th>
                <th>{at("Что это", "What it is", "Бұл не")}</th>
                <th>{at("Курс", "Course", "Курс")}</th>
                <th>{at("Камера", "Camera", "Камера")}</th>
                <th>{at("Казахский", "Kazakh", "Қазақша")}</th>
              </tr>
            </thead>
            <tbody>
              {ANALOGS().map((a) => (
                <tr key={a.name}>
                  <td>
                    <a href={a.url} target="_blank" rel="noreferrer"><b>{a.name}</b></a>
                    <small>{a.who}</small>
                  </td>
                  <td>{a.what}</td>
                  <td>{a.course ? yes : no}</td>
                  <td>{a.cam ? yes : no}</td>
                  <td>{a.kz ? yes : no}</td>
                </tr>
              ))}
              <tr className="ours">
                <td><b>AI Mentor</b><small>{at("наш проект", "our project", "біздің жоба")}</small></td>
                <td>
                  {at(
                    "Курс A1–B1, словарь, тренажёры, ИИ-распознавание 1000 жестов и дактиля (РЖЯ 33 + казахский 42) с камеры в браузере, перевод текста в жесты, интерфейс на 3 языках",
                    "A1–B1 course, dictionary, trainers, in-browser AI recognition of 1,000 signs and fingerspelling (RSL 33 + Kazakh 42), text-to-sign, 3 UI languages",
                    "A1–B1 курсы, сөздік, 1000 ым мен дактильді браузерде тану, мәтінді ымға аудару, 3 тіл",
                  )}
                </td>
                <td>{yes}</td>
                <td>{yes}</td>
                <td>{yes}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <div className="culture-sections">
        <section className="panel culture-section">
          <h2>{at("Наши преимущества", "Our strengths", "Біздің артықшылықтар")}</h2>
          <ul>
            <li>{at("Распознавание с камеры работает в браузере: видео не уходит на сервер.", "Camera recognition runs in the browser; video never leaves the device.", "Тану браузерде жұмыс істейді.")}</li>
            <li>{at("Модель сама называет показанный жест или букву из 1000 слов и 42 букв, а не только сравнивает с одним эталоном.", "The model names the sign among 1,000 words and 42 letters, not just compares with one reference.", "Модель 1000 сөз бен 42 әріптің ішінен ымды атайды.")}</li>
            <li>{at("Полный путь ученика: тест уровня, курс A1–B1, словарь, грамматика, мимика, диалоги, культура глухих.", "A full learner path: placement test, A1–B1 course, grammar, facial grammar, dialogues, Deaf culture.", "Толық оқу жолы: деңгей тесті, курс, грамматика, диалогтар.")}</li>
            <li>{at("Открыто указаны точность моделей и их ограничения.", "Model accuracy and limits are published openly.", "Модель дәлдігі ашық көрсетілген.")}</li>
          </ul>
        </section>
        <section className="panel culture-section">
          <h2>{at("Что ещё предстоит", "What is still ahead", "Алдағы жұмыс")}</h2>
          <ul>
            <li>{at("Казахские региональные жесты для слов: нужен лицензированный видеонабор или записи носителей с согласием.", "Kazakh regional word signs: needs a licensed video set or consented recordings.", "Қазақ аймақтық ымдары үшін деректер керек.")}</li>
            <li>{at("Записи казахских букв с камеры от разных людей — чтобы поднять точность 9 казахских букв.", "Camera recordings of the 9 Kazakh letters from many people.", "9 қазақ әрпінің камера жазбалары.")}</li>
            <li>{at("Проверка материалов сурдопедагогами и глухими носителями из Казахстана.", "Review by Kazakh Deaf signers and teachers.", "Қазақстандық сурдопедагогтардың тексеруі.")}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
