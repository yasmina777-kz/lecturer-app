import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Camera, Circle, RotateCcw, Trash2 } from "lucide-react";
import { at } from "../i18n/automation";
import { useActivityCatalog } from "../sign/useActivities";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./fingerspell.css";
import "./course.css";

/** How to check yourself without a native signer + where to practise with people.
 * The mirror tool records 4 s from the webcam and loops it beside the reference. */
const PARAMS = () => [
  { name: at("Форма руки", "Handshape", "Қол пішіні"), q: "Те же пальцы согнуты и выпрямлены, что у носителя?" },
  { name: at("Место", "Location", "Орын"), q: "Жест там же: у лица, у груди, в нейтральном пространстве?" },
  { name: at("Движение", "Movement", "Қозғалыс"), q: "Та же траектория, повторы и скорость?" },
  { name: at("Ладонь", "Palm orientation", "Алақан"), q: "Ладонь повёрнута туда же: к себе, от себя, вниз?" },
  { name: at("Лицо", "Face", "Бет"), q: "Есть нужная мимика: брови, губы, кивок или покачивание?" },
];

export function LivePracticePage() {
  const { data } = useActivityCatalog();
  const [query, setQuery] = useState("привет");
  const [selected, setSelected] = useState<string>("Привет!");
  const cam = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [clip, setClip] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);
  function remove() {
    if (clip) URL.revokeObjectURL(clip);
    setClip(null);
    setDeleted(true);
  }
  const entries = data?.entries ?? [];
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? entries.filter((e) => e.label.toLowerCase().startsWith(q)).slice(0, 8) : [];
  }, [query, entries]);
  const entry = entries.find((e) => e.label === selected);
  async function startCam() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      setStream(s);
      setError("");
      requestAnimationFrame(() => {
        if (cam.current) {
          cam.current.srcObject = s;
          void cam.current.play();
        }
      });
    } catch {
      setError(at("Камера недоступна. Откройте сайт в Chrome и разрешите камеру.", "Camera unavailable.", "Камера қолжетімсіз."));
    }
  }
  function record() {
    if (!stream || recording) return;
    const parts: Blob[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    rec.onstop = () => {
      if (clip) URL.revokeObjectURL(clip);
      setClip(URL.createObjectURL(new Blob(parts, { type: rec.mimeType || "video/webm" })));
      setRecording(false);
    };
    setRecording(true);
    setDeleted(false);
    if (clip) URL.revokeObjectURL(clip);
    setClip(null);
    rec.start();
    setTimeout(() => rec.stop(), 4000);
  }
  return (
    <div className="sign-workspace vocab fingerspell course">
      <Link className="text-link back-link" to="/course">
        <ArrowLeft size={16} /> {at("Курс", "Course", "Курс")}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{at("ПРАКТИКА", "PRACTICE", "ТӘЖІРИБЕ")}</span>
          <h1>{at("Самопроверка и живая практика", "Self-check and live practice", "Өзін-өзі тексеру")}</h1>
          <p>{at("Нет носителя рядом? Сравнивайте себя с видео по пяти параметрам жеста — так делают и на курсах. А живое общение найдите в сообществе глухих.", "No native signer nearby? Compare yourself with the video on five parameters, and find live practice in the Deaf community.", "Бес параметр бойынша салыстырыңыз.")}</p>
        </div>
      </div>

      <section className="panel fs-answer">
        <h2>{at("Зеркало: вы рядом с носителем", "Mirror: you next to the signer", "Айна")}</h2>
        <div className="mirror-search">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={at("Найдите слово", "Find a word", "Сөзді табыңыз")} />
          <div className="vocab-chips">
            {matches.map((m) => (
              <button key={m.id} aria-pressed={m.label === selected} onClick={() => { setSelected(m.label); setClip(null); }}>
                {m.label.replace(/[!?]$/, "")}
              </button>
            ))}
          </div>
        </div>
        <div className="mirror-grid">
          <figure>
            {entry && <video key={entry.id} className="test-video" src={entry.displayVideo || entry.video} autoPlay loop muted playsInline controls />}
            <figcaption>{at("Образец", "Reference", "Үлгі")}: {selected.replace(/[!?]$/, "")}</figcaption>
          </figure>
          <figure>
            {clip ? (
              <video key={clip} className="test-video face-mirror" src={clip} autoPlay loop muted playsInline />
            ) : (
              <video ref={cam} className="test-video face-mirror" muted playsInline />
            )}
            <figcaption>{clip ? at("Ваша запись", "Your recording", "Сіздің жазбаңыз") : at("Камера", "Camera", "Камера")}</figcaption>
          </figure>
        </div>
        <div className="fs-actions">
          {!stream ? (
            <button className="button primary" onClick={startCam}><Camera size={18} /> {at("Включить камеру", "Turn on camera", "Камераны қосу")}</button>
          ) : (
            <>
              <button className="button primary" onClick={record} disabled={recording}>
                <Circle size={16} /> {recording ? at("Запись… 4 с", "Recording… 4 s", "Жазылуда…") : at("Записать себя (4 с)", "Record yourself (4 s)", "Өзіңізді жазу")}
              </button>
              {clip && <button className="button secondary" onClick={record}><RotateCcw size={16} /> {at("Записать заново", "Record again", "Қайта жазу")}</button>}
              {clip && <button className="button secondary" onClick={remove}><Trash2 size={16} /> {at("Удалить запись", "Delete recording", "Жазбаны өшіру")}</button>}
            </>
          )}
        </div>
        {error && <p className="translate-status error">{error}</p>}
        {deleted && <p className="vocab-feedback ok" role="status">{at("Запись удалена.", "Recording deleted.", "Жазба өшірілді.")}</p>}
        <p className="fs-tip">{at("Запись хранится только в памяти этой вкладки: она не сохраняется на компьютер и не отправляется на сервер, а при закрытии или обновлении страницы исчезает.", "The recording lives only in this tab's memory; it is never saved or uploaded and disappears when you close or reload the page.", "Жазба тек осы беттің жадында.")}</p>
        <h3>{at("Сравните по пяти параметрам", "Compare on five parameters", "Бес параметр")}</h3>
        <ol className="params-list">
          {PARAMS().map((p) => (
            <li key={p.name}><strong>{p.name}.</strong> {p.q}</li>
          ))}
        </ol>
        <p className="fs-tip">{at("Ещё помогает: смотреть образец на 0.5×, сравнивать несколько разных носителей (жесты немного различаются) и проверять жест камерой в тренажёре слов.", "Also: watch at 0.5×, compare several signers, use the camera check.", "0.5× жылдамдықпен қараңыз.")}</p>
      </section>

      <div className="culture-sections" style={{ marginTop: 16 }}>
        <section className="panel culture-section">
          <h2>{at("Где найти носителей языка", "Where to find native signers", "Ана тілінде сөйлейтіндер")}</h2>
          <ul>
            <li>Региональное отделение Всероссийского общества глухих (ВОГ): клубы, курсы РЖЯ, мероприятия.</li>
            <li>Курсы и кружки РЖЯ при вузах, библиотеках и центрах для глухих.</li>
            <li>Театры жестовой речи и мероприятия сообщества — например, в Международный день глухих (последнее воскресенье сентября) и Международный день жестовых языков (23 сентября).</li>
            <li>Онлайн-сообщества глухих и видеовстречи для изучающих РЖЯ.</li>
            <li>Волонтёрство на мероприятиях для глухих — лучшая живая практика.</li>
          </ul>
        </section>
        <section className="panel culture-section">
          <h2>{at("Как попросить о практике", "How to ask for practice", "Тәжірибе сұрау")}</h2>
          <ul>
            <li>Представьтесь дактилем и скажите, что учите РЖЯ: Я ЖЕСТЫ ИЗУЧИТЬ.</li>
            <li>Не стесняйтесь просить: «Покажи ещё раз», «Медленнее, пожалуйста».</li>
            <li>Уважайте время собеседника: глухие не обязаны быть учителями — благодарите и предлагайте помощь взамен.</li>
            <li>Спросите, как в этом городе показывают слово: жесты в регионах различаются.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
