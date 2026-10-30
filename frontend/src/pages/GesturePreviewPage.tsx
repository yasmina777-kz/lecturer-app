import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Pause, Play, RotateCcw, ScanSearch } from "lucide-react";
import { SIGN_DURATION } from "../components/SigningArms";
import { GestureMentor3D, type GestureAngle } from "../components/GestureMentor3D";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { at } from "../i18n/automation";
import "./gesture-preview.css";

const DURATION = SIGN_DURATION;
export function GesturePreviewPage({ embedded = false }: { embedded?: boolean } = {}) {
  const TitleTag = embedded ? "h2" : "h1";
  const [time, setTime] = useState(0);
  const clock = useRef(0);
  const [closeup, setCloseup] = useState(false);
  const [cameraRevision, setCameraRevision] = useState(0);
  const [angle, setAngle] = useState<GestureAngle>("three-quarter");
  const [guides, setGuides] = useState(false);
  const [playing, setPlaying] = useState(() => !embedded && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => { if (reduced.matches) setPlaying(false); };
    reduced.addEventListener("change", stop);
    return () => reduced.removeEventListener("change", stop);
  }, []);
  useEffect(() => {
    if (!playing) return;
    let frame = 0, last = 0;
    const animate = (now: number) => {
      if (document.hidden) { last = 0; frame = requestAnimationFrame(animate); return; }
      const delta = last ? Math.min((now-last)/1000,.05)*speed : 0; last = now;
      clock.current += delta;
      if (clock.current >= DURATION) {
        if (loop) clock.current %= DURATION;
        else { clock.current = DURATION; setTime(DURATION); setPlaying(false); return; }
      }
      setTime(clock.current);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [playing, loop, speed]);
  const seek = (value: number) => { clock.current = value; setTime(value); };
  const replay = () => { setGuides(false); setCloseup(false); seek(0); setPlaying(true); };
  const showStep = (step:number) => { setGuides(true); setCloseup(true); setAngle("three-quarter"); setPlaying(false); seek(step===0 ? 3.5 : 5.4); };
  const lessonStep = time>=4.3 && time<6.3 ? 1 : 0;
  const phase = time < .5 ? 0 : time < 1.8 ? 1 : time < 4.3 ? 2 : time < 6.2 ? 3 : 0;
  const phases = [at("Спокойная поза", "Resting pose", "Тыныш қалып"),at("Подготовка", "Preparation", "Дайындық"),at("Две руки", "Both hands", "Екі қол"),at("Обращение", "Addressing someone", "Сұхбаттасушыға бағыттау")];
  const phrase = at("Как тебя зовут?", "What is your name?", "Сенің атың кім?");

  return <div className={`gesture-page${embedded ? " gesture-embedded" : ""}`}>
    {!embedded && <header className="gesture-header"><Link to="/"><ArrowLeft size={18}/>AI Mentor</Link><div><ThemeSwitcher/><LanguageSwitcher/></div></header>}
    <div className="gesture-layout">
      <section className={`gesture-stage gesture-stage-3d${closeup ? " is-closeup" : ""}`} aria-label={at("3D-прототип фразы на русском жестовом языке", "3D prototype of a Russian Sign Language phrase", "Орыс ым тіліндегі сөйлемнің 3D прототипі")}>
        <div className="gesture-stage-caption"><span>MIRA / BLENDER</span><span>{guides ? at(`ШАГ ${lessonStep+1} / 2`, `STEP ${lessonStep+1} / 2`, `${lessonStep+1} / 2 ҚАДАМ`) : "05"}</span></div>
        <div className="gesture-backdrop" aria-hidden="true"/>
        <div className="gesture-greeting" style={{opacity:phase>0?1:0,transform:`translateY(${phase>0?0:6}px)`}} aria-hidden="true">{phrase}</div>
        <GestureMentor3D time={time} closeup={closeup} angle={angle} resetToken={cameraRevision}/>
        {<button className="gesture-closeup" aria-pressed={closeup} onClick={()=>setCloseup(!closeup)}><ScanSearch size={16}/>{closeup ? at("Весь аватар", "Full avatar", "Толық аватар") : at("Крупнее руки", "Hands close-up", "Қолдарды үлкейту")}</button>}
        <div className="gesture-stage-footer"><span>{guides ? at("РАЗБОР ДВИЖЕНИЯ", "MOVEMENT BREAKDOWN", "ҚИМЫЛДЫ ТАЛДАУ") : "3D / WEBGL"}</span><span>{guides ? (lessonStep===0 ? at("Контакт пальцев", "Finger contact", "Саусақтардың жанасуы") : at("К собеседнику", "Towards the viewer", "Сұхбаттасушыға")) : phases[phase]}</span></div>
      </section>
      <section className="gesture-details" aria-labelledby="gesture-title">
        <span className="gesture-eyebrow">{at("РУССКИЙ ЖЕСТОВЫЙ ЯЗЫК / ПРОТОТИП", "RUSSIAN SIGN LANGUAGE / PROTOTYPE", "ОРЫС ЫМ ТІЛІ / ПРОТОТИП")}</span>
        <TitleTag id="gesture-title">{at("Как тебя", "What is", "Сенің атың")}<span>{at("зовут?", "your name?", "кім?")}</span></TitleTag>
        <p>{at("Новая наставница с человеческими пропорциями и цельными кистями. Плавные движения рук, головы и мимика подготовлены в Blender. Поверните модель или приблизьте руки, чтобы рассмотреть жест.", "A new mentor with human proportions and continuous hand meshes. Arm movements, head motion and expressions were prepared in Blender. Rotate the model or zoom in on the hands to inspect the gesture.", "Адамға тән пропорциялары мен тұтас қолдары бар жаңа тәлімгер. Қол мен бас қимылдары және мимика Blender-де дайындалды. Ымды көру үшін модельді бұрыңыз немесе қолдарды үлкейтіңіз.")}</p>
        <div className="gesture-camera" role="group" aria-label={at("Ракурс камеры", "Camera angle", "Камера бұрышы")}>
          {(["front","three-quarter","side"] as GestureAngle[]).map((value,i)=><button key={value} aria-pressed={angle===value} onClick={()=>{setAngle(value);setCameraRevision(v=>v+1);}}>{[at("Спереди", "Front", "Алдынан"),"¾",at("Сбоку", "Side", "Жанынан")][i]}</button>)}
        </div>
        <p className="gesture-camera-hint">{at("Потяните модель, чтобы повернуть её. Кнопки возвращают точный ракурс.", "Drag the model to rotate it. The buttons restore a preset view.", "Модельді бұру үшін сүйреңіз. Түймелер берілген ракурсқа қайтарады.")}</p>
        <div className="gesture-modes" role="group" aria-label={at("Режим просмотра", "Viewing mode", "Көру режимі")}>
          <button aria-pressed={guides} onClick={()=>showStep(0)}>{at("По шагам", "Step by step", "Қадам бойынша")}</button>
          <button aria-pressed={!guides} onClick={replay}>{at("Вся фраза", "Full phrase", "Толық сөйлем")}</button>
        </div>
        <ol className="gesture-steps">{[at("Контакт пальцев", "Finger contact", "Саусақтардың жанасуы"),at("К собеседнику", "Towards the viewer", "Сұхбаттасушыға")].map((label,i)=><li key={i} className={guides && lessonStep===i?"is-current":""}><button onClick={()=>showStep(i)} aria-pressed={guides && lessonStep===i}><b>0{i+1}</b>{label}</button></li>)}</ol>
        {guides && <div className="gesture-instruction" aria-live="polite">
          <h2>{lessonStep===0 ? at("Какие пальцы участвуют", "Which fingers are involved", "Қай саусақтар қатысады") : at("Направление — к зрителю", "Direction: towards the viewer", "Бағыт — көрерменге")}</h2>
          {lessonStep===0 ? <>
            <p><b className="finger-key finger-key-blue">1</b>{at("Средний палец правой руки аватара.", "The middle finger of the avatar's right hand.", "Аватардың оң қолының ортаңғы саусағы.")}</p>
            <p><b className="finger-key finger-key-gold">2</b>{at("Большой палец левой руки аватара.", "The thumb of the avatar's left hand.", "Аватардың сол қолының бас бармағы.")}</p>
            <strong>{at("На этом этапе кончики пальцев соприкасаются.", "At this stage, the fingertips touch.", "Бұл кезеңде саусақтардың ұштары жанасады.")}</strong>
          </> : <>
            <p><b className="finger-key finger-key-blue">1</b>{at("Указательный палец направлен к собеседнику — то есть к вам.", "The index finger points towards the other person — towards you.", "Сұқ саусақ сұхбаттасушыға, яғни сізге бағытталған.")}</p>
            <strong>{at("Выберите «Сбоку», чтобы увидеть вытянутый вперёд палец и сгибание остальных пальцев.", "Choose Side to see the finger extending forwards while the other fingers curl.", "Алға созылған саусақты және қалған саусақтардың бүгілуін көру үшін «Жанынан» таңдаңыз.")}</strong>
          </>}
          <small>{at("Стороны указаны со стороны аватара. Ракурс можно менять и на паузе.", "Left and right refer to the avatar. You can change the view while paused.", "Оң және сол жақ аватарға қатысты. Кідіріс кезінде де ракурсты өзгертуге болады.")}</small>
        </div>}
        <div className="gesture-controls">
          <div className="gesture-buttons"><button className="gesture-play" onClick={()=>{if(guides || time>=DURATION) replay(); else setPlaying(!playing);}}>{playing?<Pause size={18}/>:<Play size={18}/>} {playing?at("Пауза", "Pause", "Кідірту"):guides ? at("Смотреть всю фразу", "Watch full phrase", "Толық сөйлемді көру") : at("Смотреть", "Play", "Көру")}</button>{!guides && <button className="gesture-replay" onClick={replay}><RotateCcw size={18}/>{at("Сначала", "Replay", "Қайта көру")}</button>}</div>
          {!guides && <><label className="gesture-timeline"><span>{at("Движение по кадрам", "Explore the movement", "Қимылды кадр бойынша көру")}<output aria-live="off">{time.toFixed(1)} / {DURATION} {at("с", "s", "с")}</output></span><input type="range" min="0" max={DURATION} step=".01" value={Number(time.toFixed(2))} aria-label={at("Кадр анимации", "Animation position", "Анимация кадры")} onChange={e=>{setPlaying(false);seek(Number(e.target.value));}}/></label>
          <div className="gesture-options"><label><input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/>{at("Повторять", "Loop", "Қайталау")}</label><label>{at("Темп", "Speed", "Қарқын")}<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1">1×</option></select></label></div></>}
        </div>
        <div className="gesture-reference"><span>{at("УЧЕБНЫЙ ОБРАЗЕЦ", "REFERENCE", "ОҚУ ҮЛГІСІ")}</span><a href="https://www.youtube.com/watch?v=XhfuzmNWmGA&t=17s" target="_blank" rel="noreferrer">{at("Посмотреть, как показывает человек ↗", "Watch the human demonstration ↗", "Адам қалай көрсететінін көру ↗")}</a><small>{at("Учебное видео ВОГ «Давайте знакомиться!», раздел «Поговорим», с 00:17. Во всех версиях интерфейса — РЖЯ.", "Conversation section, from 00:17. The sign language stays RSL in every interface language.", "«Сөйлесейік» бөлімі, 00:17-ден бастап. Интерфейс тілі өзгерсе де, ым тілі — орыс ым тілі.")}</small></div>
        <p className="gesture-note">{at("Это 3D-прототип, а не проверенный перевод. Формы кистей, направление движения и мимику ещё должен проверить носитель РЖЯ. Для изучения используйте оригинальное видео.", "This is a 3D prototype, not a verified translation. Hand shapes, movement and facial expression still need review by an RSL signer. Use the original video for learning.", "Бұл — тексерілген аударма емес, 3D прототип. Қол пішіні, қозғалыс және мимиканы орыс ым тілінің маманы тексеруі керек. Үйрену үшін түпнұсқа бейнені қолданыңыз.")}</p>
      </section>
    </div>
  </div>;
}
