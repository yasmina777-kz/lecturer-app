import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  AudioLines,
  ListChecks,
  Pause,
  Play,
} from "lucide-react";
import { Link } from "react-router-dom";
import { at } from "../i18n/automation";
import { FeatureExplorer } from "./FeatureExplorer";
import { KnowledgeScene } from "./KnowledgeScene";

export function ProjectStory({
  paused,
  destination,
}: {
  paused: boolean;
  destination: string;
}) {
  const [scenePaused, setScenePaused] = useState(false);
  return (
    <>
      <section
        className="project-intro mentor-section"
        id="about-project"
        data-reveal
      >
        <div className="mentor-section-heading">
          <span className="mentor-kicker">
            AI MENTOR / {at("О ПРОЕКТЕ", "THE IDEA", "ЖОБА ТУРАЛЫ")}
          </span>
          <h2>
            {at("Не просто смотреть.", "Go beyond watching.", "Тек қарап қана қоймаңыз.")}
            <br />
            <span>
              {at("Понимать движение.", "Understand the movement.", "Қимылды түсініңіз.")}
            </span>
          </h2>
          <div className="lesson-route" aria-label={at("Путь обучения", "Learning journey", "Оқу жолы")}>
            <div className="lesson-route-art"><img src="/images/learning-path-v1.png" alt="" loading="lazy"/><span>{at("Одна тема. Три шага вперёд.", "One topic. Three steps forward.", "Бір тақырып. Алға үш қадам.")}</span></div>
            <div className="lesson-route-steps">{[at("Изучить", "Explore", "Зерттеу"), at("Разобрать", "Inspect", "Талдау"), at("Повторить", "Practise", "Қайталау")].map((label,i)=><span key={label}><b>0{i+1}</b>{label}</span>)}</div>
          </div>
        </div>
        <div className="project-intro-copy">
          <p>
            {at("AI Mentor меняет направление: теперь это проект для изучения русского жестового языка с аватаром. Наша цель — помочь увидеть не только общий жест, но и положение пальцев, движение кистей и выражение лица.", "AI Mentor is changing direction: it is now a project for learning Russian Sign Language with an avatar. Our goal is to make finger positions, hand movements and facial expressions easier to inspect.", "AI Mentor бағытын өзгертеді: енді бұл аватармен орыс ым тілін үйренуге арналған жоба. Мақсатымыз — саусақ қалпын, қол қимылын және мимиканы анық көруге көмектесу.")}
          </p>
          <p>
            {at("Первый шаг уже можно посмотреть: 3D-прототип фразы «Как тебя зовут?» с управлением ракурсом и скоростью. Полноценный курс будем строить вместе со специалистами по РЖЯ. Для трёх букв — А, В, Л — уже подключено пилотное распознавание по фото и камере.", "The first step is available: a 3D prototype of “What is your name?” with angle and speed controls. A full course will need RSL specialists. Pilot photo and camera recognition is now available for А, В, Л.", "Алғашқы қадам қолжетімді: ракурс пен қарқын басқаруы бар «Сенің атың кім?» 3D прототипі. Толық курсты орыс ым тілі мамандарымен әзірлейміз. А, В, Л әріптерін фото мен камера арқылы сынақ тану қосылды.")}
          </p>
          <div className="project-pill-row">
            <span>RU / EN / KZ</span>
            <span>
              {at("Движение по шагам", "Movement step by step", "Қимылды қадаммен қарау")}
            </span>
            <span>
              {at("Ваш темп обучения", "Your own pace", "Өз оқу қарқыныңыз")}
            </span>
          </div>
        </div>
      </section>
      <section
        id="learning-universe"
        className="learning-universe mentor-section"
        aria-labelledby="universe-title"
        data-reveal
      >
        <div className="universe-copy">
          <span className="mentor-kicker">
            01—04 /{" "}
            {at("ВСЁ СВЯЗАНО", "EVERYTHING CONNECTS", "БӘРІ БАЙЛАНЫСТЫ")}
          </span>
          <h2 id="universe-title">
            {at("У каждого жеста —", "Every sign has", "Әр ымның")}
            <br />
            <span>{at("свои детали.", "its own details.", "өз бөлшектері бар.")}</span>
          </h2>
          <p>
            {at("Форма кисти, направление движения и мимика работают вместе. Пауза и разные ракурсы помогают рассмотреть детали, а повторение по видеообразцу — попробовать самому.", "Hand shape, movement direction and facial expression work together. Pause and different views reveal the details; the reference video supports your own practice.", "Қол пішіні, қимыл бағыты мен мимика бірге қолданылады. Кідіріс пен түрлі ракурстар бөлшектерді көруге, ал бейнеүлгі өзіңіз қайталауға көмектеседі.")}
          </p>
          <Link className="universe-link" to={destination}>
            {at("Перейти к обучению", "Start exploring", "Оқуға өту")}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="universe-stage">
          <KnowledgeScene paused={paused || scenePaused} />
          <span className="universe-label label-material">
            <BookOpen size={15} />
            {at("Жест", "Sign", "Ым")}
          </span>
          <span className="universe-label label-dialogue">
            <AudioLines size={15} />
            {at("Движение", "Movement", "Қимыл")}
          </span>
          <span className="universe-label label-practice">
            <ListChecks size={15} />
            {at("Практика", "Practice", "Жаттығу")}
          </span>
          <button
            className="universe-motion"
            disabled={paused}
            aria-label={
              paused || scenePaused
                ? at(
                    "Включить 3D-анимацию",
                    "Play 3D animation",
                    "3D анимацияны қосу",
                  )
                : at(
                    "Остановить 3D-анимацию",
                    "Pause 3D animation",
                    "3D анимацияны тоқтату",
                  )
            }
            aria-pressed={paused || scenePaused}
            onClick={() => setScenePaused(!scenePaused)}
          >
            {paused || scenePaused ? <Play size={13} /> : <Pause size={13} />}{" "}
            {at("Анимация 3D", "3D animation", "3D анимация")}
          </button>
        </div>
      </section>
      <section className="mentor-section project-details" id="inside-platform" data-reveal>
        <div className="mentor-section-heading">
          <span className="mentor-kicker">
            {at("ЧТО ВНУТРИ", "INSIDE THE PLATFORM", "ПЛАТФОРМАДА НЕ БАР")}
          </span>
          <h2>
            {at("От первого жеста", "From your first sign", "Алғашқы ымнан")}
            <br />
            <span>
              {at("к первому знакомству.", "to your first introduction.", "алғашқы танысуға.")}
            </span>
          </h2>
        </div>
        <FeatureExplorer />
        <p className="project-service-note">
          {at("В кабинете доступны пробные показы трёх букв, приветствия и фразы знакомства. Они требуют проверки специалистом РЖЯ. Пилотный ИИ различает А, В, Л; остальные жесты пока не распознаёт. Примеры на главной иллюстрируют учебный процесс.", "The workspace includes trial demonstrations of three letters, a greeting and an introduction phrase. They need specialist review. The pilot AI distinguishes А, В, Л only. Landing-page examples illustrate the learning process.", "Кабинетте үш әріп, амандасу және танысу сөйлемінің сынақ көрсетілімдері бар. Оларды маман тексеруі қажет. Сынақ ЖИ тек А, В, Л әріптерін ажыратады. Басты беттегі мысалдар оқу үдерісін көрсетеді.")}
        </p>
      </section>
    </>
  );
}
