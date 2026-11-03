import { ArrowUpRight, BookOpen, Camera, Layers, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { at } from "../i18n/automation";
import { FeatureExplorer } from "./FeatureExplorer";

export function ProjectStory({ destination }: { destination: string }) {
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
            {at(
              "Не просто смотреть.",
              "Go beyond watching.",
              "Тек қарап қана қоймаңыз.",
            )}
            <br />
            <span>
              {at(
                "Понимать движение.",
                "Understand the movement.",
                "Қимылды түсініңіз.",
              )}
            </span>
          </h2>
          <p className="project-intro-lead">
            {at(
              "Учитесь через наглядные примеры, разбор жестов и практику в своём темпе.",
              "Learn through visual examples, detailed signs and practice at your own pace.",
              "Көрнекі мысалдар, ымдарды талдау және өз қарқыныңызбен жаттығу арқылы үйреніңіз.",
            )}
          </p>
          <div className="project-highlights">
            {[
              {
                Icon: Camera,
                title: at(
                  "Распознавание букв",
                  "Letter recognition",
                  "Әріптерді тану",
                ),
                text: at(
                  "Экспериментальная проверка по видео",
                  "Experimental checking from video",
                  "Бейне арқылы тәжірибелік тексеру",
                ),
              },
              {
                Icon: Layers,
                title: at(
                  "Движение по шагам",
                  "Movement step by step",
                  "Қимылды қадаммен талдау",
                ),
                text: at(
                  "Ракурсы, пауза и замедление",
                  "Views, pause and slow motion",
                  "Ракурстар, кідіріс және баяулату",
                ),
              },
              {
                Icon: BookOpen,
                title: at(
                  "Практика в своём темпе",
                  "Practise at your own pace",
                  "Өз қарқыныңызбен жаттығыңыз",
                ),
                text: at(
                  "Смотрите, разбирайте и повторяйте",
                  "Watch, explore and repeat",
                  "Қараңыз, талдаңыз, қайталаңыз",
                ),
              },
            ].map(({ Icon, title, text }) => (
              <div key={title}>
                <span>
                  <Icon size={21} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="project-mentor-visual">
          <img
            src="/images/landing-v2/mentor-pointing.webp"
            alt=""
            loading="lazy"
          />
          <Link
            to="/gesture-preview"
            aria-label={at(
              "Открыть демонстрацию",
              "Open demonstration",
              "Көрсетілімді ашу",
            )}
          >
            <ArrowUpRight size={22} />
          </Link>
        </div>
        <details className="project-intro-copy">
          <summary>
            {at(
              "О проекте и текущих возможностях",
              "About the project and current capabilities",
              "Жоба және қазіргі мүмкіндіктер туралы",
            )}
          </summary>
          <p>
            {at(
              "AI Mentor — проект для изучения русского жестового языка с аватаром. Смотрите движения, разбирайте положение рук и повторяйте фразы в своём темпе. Начните с пробной 3D-демонстрации.",
              "AI Mentor is a project for learning Russian Sign Language with an avatar. Explore movements and hand positions, then practise phrases at your own pace. Start with the 3D prototype.",
              "AI Mentor — аватармен орыс ым тілін үйренуге арналған жоба. Қимылдар мен қол қалпын қарап, сөйлемдерді өз қарқыныңызбен қайталаңыз. Сынақ 3D көрсетілімінен бастаңыз.",
            )}
          </p>
          <p>
            {at(
              "AI Mentor меняет направление: теперь это проект для изучения русского жестового языка с аватаром. Наша цель — помочь увидеть не только общий жест, но и положение пальцев, движение кистей и выражение лица.",
              "AI Mentor is changing direction: it is now a project for learning Russian Sign Language with an avatar. Our goal is to make finger positions, hand movements and facial expressions easier to inspect.",
              "AI Mentor бағытын өзгертеді: енді бұл аватармен орыс ым тілін үйренуге арналған жоба. Мақсатымыз — саусақ қалпын, қол қимылын және мимиканы анық көруге көмектесу.",
            )}
          </p>
          <p>
            {at(
              "Первый шаг уже можно посмотреть: 3D-прототип фразы «Как тебя зовут?» с управлением ракурсом и скоростью. Полноценный курс будем строить вместе со специалистами по РЖЯ. Для трёх букв — А, В, Л — уже подключено пилотное распознавание по фото и камере.",
              "The first step is available: a 3D prototype of “What is your name?” with angle and speed controls. A full course will need RSL specialists. Pilot photo and camera recognition is now available for А, В, Л.",
              "Алғашқы қадам қолжетімді: ракурс пен қарқын басқаруы бар «Сенің атың кім?» 3D прототипі. Толық курсты орыс ым тілі мамандарымен әзірлейміз. А, В, Л әріптерін фото мен камера арқылы сынақ тану қосылды.",
            )}
          </p>
          <div className="project-pill-row">
            <span>RU / EN / KZ</span>
            <span>
              {at(
                "Движение по шагам",
                "Movement step by step",
                "Қимылды қадаммен қарау",
              )}
            </span>
            <span>
              {at("Ваш темп обучения", "Your own pace", "Өз оқу қарқыныңыз")}
            </span>
          </div>
        </details>
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
            <span>
              {at("свои детали.", "its own details.", "өз бөлшектері бар.")}
            </span>
          </h2>
          <p>
            {at(
              "Форма кисти, направление движения и мимика работают вместе. Пауза и разные ракурсы помогают рассмотреть детали, а повторение по видеообразцу — попробовать самому.",
              "Hand shape, movement direction and facial expression work together. Pause and different views reveal the details; the reference video supports your own practice.",
              "Қол пішіні, қимыл бағыты мен мимика бірге қолданылады. Кідіріс пен түрлі ракурстар бөлшектерді көруге, ал бейнеүлгі өзіңіз қайталауға көмектеседі.",
            )}
          </p>
          <Link className="universe-link" to={destination}>
            {at("Перейти к обучению", "Start exploring", "Оқуға өту")}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="universe-stage">
          <div className="detail-hand-frame">
            <img
              className="landing-detail-hands"
              src="/images/landing-v2/hand-v.webp"
              alt=""
              loading="lazy"
            />
            <i />
            <i />
            <i />
            <i />
          </div>
          <ul className="detail-checklist">
            {[
              at("Положение рук", "Hand position", "Қол қалпы"),
              at("Направление", "Direction", "Бағыт"),
              at("Движение", "Movement", "Қимыл"),
              at("Значение", "Meaning", "Мағына"),
            ].map((label) => (
              <li key={label}>
                <Check size={17} />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

export function ProjectDetails() {
  return (
    <section
      className="mentor-section project-details"
      id="inside-platform"
      data-reveal
    >
      <div className="mentor-section-heading">
        <span className="mentor-kicker">
          {at("ЧТО ВНУТРИ", "INSIDE THE PLATFORM", "ПЛАТФОРМАДА НЕ БАР")}
        </span>
        <h2>
          {at("От первого жеста", "From your first sign", "Алғашқы ымнан")}
          <br />
          <span>
            {at(
              "к первому знакомству.",
              "to your first introduction.",
              "алғашқы танысуға.",
            )}
          </span>
        </h2>
      </div>
      <FeatureExplorer />
      <p className="project-service-note">
        {at(
          "В кабинете доступны пробные показы трёх букв, приветствия и фразы знакомства. Они требуют проверки специалистом РЖЯ. Пилотный ИИ различает А, В, Л; остальные жесты пока не распознаёт. Примеры на главной иллюстрируют учебный процесс.",
          "The workspace includes trial demonstrations of three letters, a greeting and an introduction phrase. They need specialist review. The pilot AI distinguishes А, В, Л only. Landing-page examples illustrate the learning process.",
          "Кабинетте үш әріп, амандасу және танысу сөйлемінің сынақ көрсетілімдері бар. Оларды маман тексеруі қажет. Сынақ ЖИ тек А, В, Л әріптерін ажыратады. Басты беттегі мысалдар оқу үдерісін көрсетеді.",
        )}
      </p>
    </section>
  );
}
