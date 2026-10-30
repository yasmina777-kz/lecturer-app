import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Check,
  CheckCheck,
  FileText,
  GraduationCap,
  Layers,
  Mic,
  Pause,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";
import { AvatarPlayer } from "../components/AvatarPlayer";
import { Brand } from "../components/UI";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n";
import { at } from "../i18n/automation";
import { ParticleField } from "../components/ParticleField";
import { ProjectStory } from "../components/ProjectStory";
import { LearningGallery } from "../components/LearningGallery";
export default function LandingPage() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [motionPaused, setMotionPaused] = useState(false);
  const [audience, setAudience] = useState<"student" | "teacher">("student");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0, rootMargin: "80px 0px" },
    );
    root.current
      ?.querySelectorAll("[data-reveal]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  const destination = user ? "/dashboard" : "/register";
  const steps = [
    at("Выберите фразу", "Choose a phrase", "Сөйлем таңдаңыз"),
    at("Посмотрите жест", "Watch the sign", "Ымды қараңыз"),
    at("Разберите движение", "Explore the movement", "Қимылды талдаңыз"),
    at("Повторите сами", "Practise yourself", "Өзіңіз қайталаңыз"),
  ];
  return (
    <div className={`mentor-site${motionPaused ? " motion-paused" : ""}`} ref={root}>
      <div className="mentor-reading-progress" aria-hidden="true" />
      <header className="mentor-header">
        <Link to="/" aria-label="AI Mentor">
          <Brand />
        </Link>
        <nav aria-label={t("Навигация по сайту")}>
          <a href="#about-project">{at("О проекте", "About", "Жоба туралы")}</a>
          <a href="#possibilities">{t("Возможности")}</a>
          <a href="#experience">{t("Как это работает")}</a>
          <a href="#for-you">{t("Для кого")}</a>
        </nav>
        <div className="mentor-header-actions">
          <ThemeSwitcher />
          <LanguageSwitcher />
          <Link className="mentor-signin" to={user ? "/dashboard" : "/login"}>
            {user ? t("В кабинет") : t("Войти")}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <main>
        <section className="mentor-hero">
          <div className="nova-hero-coordinate" aria-hidden="true">LEARNING, REIMAGINED / 001</div>
          <div className="mentor-ambient" aria-hidden="true"><i /><i /><i /></div>
          <div className="mentor-hero-copy">
            <span className="mentor-kicker">
              <span /> {at("Ваш наставник по языку жестов", "Your sign language mentor", "Ым тілі бойынша тәлімгеріңіз")}
            </span>
            <h1 className="mentor-warm-title">
              {at("Понимать друг друга,", "Understand each other,", "Бір-бірімізді түсіну,")}{" "}
              <span className="headline-living">{at("даже без слов.", "even without words.", "сөзсіз де мүмкін.")}<svg className="headline-stroke" viewBox="0 0 440 20" preserveAspectRatio="none" aria-hidden="true"><path d="M4 12Q180 -1 435 9"/></svg></span>
            </h1>
            <p>
              {at("AI Mentor — проект для изучения русского жестового языка с аватаром. Смотрите движения, разбирайте положение рук и повторяйте фразы в своём темпе. Начните с пробной 3D-демонстрации.", "AI Mentor is a project for learning Russian Sign Language with an avatar. Explore movements and hand positions, then practise phrases at your own pace. Start with the 3D prototype.", "AI Mentor — аватармен орыс ым тілін үйренуге арналған жоба. Қимылдар мен қол қалпын қарап, сөйлемдерді өз қарқыныңызбен қайталаңыз. Сынақ 3D көрсетілімінен бастаңыз.")}
            </p>
            <div className="mentor-hero-actions">
              <Link to="/gesture-preview" className="button secondary">{at("Посмотреть жесты аватара", "Explore the signing avatar", "Аватардың ымдарын көру")}</Link>
              <Link to={destination} className="mentor-cta">
                {user ? t("Продолжить обучение") : t("Начать обучение")}
                <ArrowUpRight size={20} />
              </Link>
              <a href="#experience" className="mentor-demo-link">
                <Play size={15} />
                {t("Посмотреть, как работает")}
              </a>
            </div>
            <div className="mentor-hero-note">
              <span>RU / EN / KZ</span>
              <i />
              {at("Смотрите. Повторяйте. Общайтесь.", "Watch. Practise. Connect.", "Қараңыз. Қайталаңыз. Тілдесіңіз.")}
            </div>
          </div>
          <div
            id="mentor-avatar"
            className="mentor-hero-art"
            aria-label={at("Виртуальная наставница Мира", "Mira, your virtual mentor", "Мира виртуалды тәлімгеріңіз")}
          >
            <ParticleField paused={motionPaused} />
            <div className="nova-nameplate"><span>MIRA</span><small>{at("ВАШ ПРОВОДНИК В МИР ЖЕСТОВ", "YOUR GUIDE TO SIGN LANGUAGE", "ЫМ ТІЛІ ӘЛЕМІНДЕГІ СЕРІГІҢІЗ")}</small></div>
            <div className="mentor-depth-panels" aria-hidden="true"><i/><i/><i/></div>
            <div className="mentor-portrait">
              <AvatarPlayer
                avatarId="classic-female"
                style="violet"
                state="speaking"
              />
            </div>
            <div className="mentor-float question-float">
              <Mic size={18} />
              <span>{at("Можно показать медленнее?", "Can you show it more slowly?", "Баяуырақ көрсете аласыз ба?")}</span>
            </div>
            <div className="mentor-float voice-float">
              <div className="mentor-wave" aria-hidden="true">
                {Array.from({ length: 15 }, (_, i) => (
                  <i key={i} style={{ animationDelay: `${i * 0.08}s` }} />
                ))}
              </div>
              <span>{at("Рассмотрим движение по шагам.", "Explore the movement step by step.", "Қимылды қадам бойынша қарайық.")}</span>
            </div>
            <div className="mentor-art-index" aria-hidden="true">
              MIRA / AI MENTOR
            </div>
          </div>
          <a className="mentor-scroll" href="#possibilities">
            <ArrowDown size={15} />
            {t("Знакомьтесь с AI Mentor")}
          </a>
          <button className="mentor-motion-toggle" type="button"
            aria-pressed={motionPaused}
            onClick={() => setMotionPaused(!motionPaused)}>
            {motionPaused ? <Play size={13} /> : <Pause size={13} />}
            {motionPaused ? t("Включить анимацию") : t("Остановить анимацию")}
          </button>
        </section>
        <div className="mentor-format-strip">
          <span>{at("Новый способ изучать язык жестов.", "A new way to explore sign language.", "Ым тілін үйренудің жаңа тәсілі.")}</span>
          <div>
            <FileText size={15} />
            РЖЯ
            <i />
            3D
            <i />
            0.25×
            <i />
            360°
            <i />
            {at("В своём темпе", "At your own pace", "Өз қарқыныңызбен")}
          </div>
        </div>
        <section id="possibilities" className="mentor-section" data-reveal>
          <div className="mentor-section-heading">
            <span className="mentor-kicker">01 / {t("Возможности")}</span>
            <h2>
              {at("От первого жеста", "From your first sign", "Алғашқы ымнан")}
              <br />
              <span>{at("к общению без слов.", "to communication without speech.", "сөзсіз қарым-қатынасқа.")}</span>
            </h2>
            <p>
              {at("Новая идея платформы — обучение через наблюдение и повторение. Аватар помогает рассмотреть движение, а видеообразец человека — свериться с оригиналом.", "The new idea is learning through observation and practice. The avatar helps you inspect a movement, while a human reference video lets you compare it with the original.", "Платформаның жаңа идеясы — бақылау және қайталау арқылы үйрену. Аватар қимылды қарауға, ал адамның бейнеүлгісі түпнұсқамен салыстыруға көмектеседі.")}
            </p>
          </div>
          <div className="feature-stories">
            {[
              {
                image: "learning-universe-v2", step: 1, icon: Layers,
                title: at("Увидеть жест со всех сторон", "See a sign from every angle", "Ымды жан-жақтан көру"),
                text: at("В пробной демонстрации можно повернуть 3D-аватара, приблизить кисти и рассмотреть положение пальцев.", "Rotate the 3D avatar in the prototype, zoom in on the hands and inspect finger positions.", "Сынақ көрсетілімінде 3D аватарды бұрып, қолдарды үлкейтіп, саусақ қалпын қарауға болады."),
                action: at("Посмотреть занятие", "Explore a lesson", "Сабақты көру"),
                alt: at("Открытая книга с объёмными учебными иллюстрациями", "An open book with three-dimensional learning illustrations", "Көлемді оқу иллюстрациялары бар ашық кітап"),
              },
              {
                image: "mentor-dialogue-v2", step: 2, icon: AudioLines,
                title: at("Разобрать движение по шагам", "Explore movement step by step", "Қимылды қадам бойынша талдау"),
                text: at("Остановите анимацию на нужном кадре или замедлите её. Рассмотрите направление движения и переход между частями фразы.", "Pause on a frame or slow the animation down. Inspect the direction and transition between parts of the phrase.", "Анимацияны қажетті кадрда тоқтатыңыз немесе баяулатыңыз. Қимыл бағыты мен сөйлем бөліктерінің ауысуын қараңыз."),
                action: at("Как устроен разбор", "Explore the breakdown", "Талдауды көру"),
                alt: at("Преподаватель объясняет студенту тему", "A teacher explaining a topic to a student", "Оқытушы студентке тақырыпты түсіндіріп жатыр"),
              },
              {
                image: "learning-path-v1", step: 3, icon: GraduationCap,
                title: at("Попробовать самостоятельно", "Try it yourself", "Өзіңіз қайталап көріңіз"),
                text: at("Повторите фразу перед зеркалом и сравните с видеообразцом. Для букв А, В, Л уже можно попробовать пилотное распознавание.", "Practise in front of a mirror and compare with the reference video. Pilot recognition is available for the letters А, В, Л.", "Айна алдында қайталап, бейнеүлгімен салыстырыңыз. А, В, Л әріптері үшін сынақ тануды қолданып көріңіз."),
                action: at("Посмотреть практику", "Explore practice", "Жаттығуды көру"),
                alt: at("Ступени с книгами ведут вверх вокруг стеклянной сферы", "Steps with books rise around a glass sphere", "Кітаптары бар баспалдақтар шыны шарды айнала жоғары көтеріледі"),
              },
            ].map(({image,step:stage,icon:Icon,title,text,action,alt},i) => (
              <article className="feature-story" key={image}>
                <div className="feature-story-image">
                  <img src={`/images/${image}.png`} width="1536" height="1024" loading="lazy" decoding="async" alt={alt}/>
                  <span className="feature-story-number">0{i+1}</span>
                </div>
                <div className="feature-story-copy">
                  <Icon size={22} aria-hidden="true"/>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <a href="#experience" onClick={() => setStep(stage)}>{action}<ArrowUpRight size={17}/></a>
                </div>
              </article>
            ))}
          </div>
        </section>
        <ProjectStory paused={motionPaused} destination={destination} />
        <section
          id="experience"
          className="mentor-section experience-section"
          data-reveal
        >
          <div className="mentor-section-heading">
            <span className="mentor-kicker">02 / {t("Как это работает")}</span>
            <h2>
              {t("Одно занятие.")}
              <br />
              <span>{at("Понятное движение.", "A clear movement.", "Түсінікті қимыл.")}</span>
            </h2>
            <p>
              {at("Переключите этапы, чтобы познакомиться с новым сценарием обучения: увидеть жест, разобраться в деталях и попробовать повторить.", "Switch steps to explore the new learning flow: watch a sign, inspect the details and try it yourself.", "Жаңа оқу жолын көру үшін кезеңдерді ауыстырыңыз: ымды көру, бөлшектерін түсіну және қайталау.")}
            </p>
          </div>
          <div className="experience-layout">
            <div
              className="experience-steps"
              role="tablist"
              aria-label={t("Этапы занятия")}
            >
              {steps.map((label, i) => (
                <button
                  key={i}
                  id={`stage-tab-${i}`}
                  role="tab"
                  aria-selected={step === i}
                  aria-controls="stage-preview"
                  onClick={() => setStep(i)}
                  onKeyDown={(e) => {
                    if (
                      [
                        "ArrowDown",
                        "ArrowUp",
                        "ArrowLeft",
                        "ArrowRight",
                        "Home",
                        "End",
                      ].includes(e.key)
                    ) {
                      e.preventDefault();
                      const n =
                        e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? 3
                            : (i +
                                (["ArrowDown", "ArrowRight"].includes(e.key)
                                  ? 1
                                  : 3)) %
                              4;
                      setStep(n);
                      document.getElementById(`stage-tab-${n}`)?.focus();
                    }
                  }}
                  tabIndex={step === i ? 0 : -1}
                >
                  <span>0{i + 1}</span>
                  <div>
                    <strong>{label}</strong>
                    <p>
                      {
                        [
                          at("Начните со знакомства: «Как тебя зовут?»", "Start with an introduction: “What is your name?”", "«Сенің атың кім?» сөйлемінен бастаңыз."),
                          at("В отдельной 3D-демонстрации аватар показывает фразу.", "The avatar demonstrates a phrase in the separate 3D preview.", "Аватар бөлек 3D көрсетілімінде сөйлемді көрсетеді."),
                          at("Пауза, замедление и разные ракурсы помогают увидеть детали.", "Pause, slow motion and different views help reveal details.", "Кідіріс, баяулату және түрлі ракурстар бөлшектерді көруге көмектеседі."),
                          at("Повторите движение, сверяясь с видеообразцом человека.", "Practise the movement using the human reference video.", "Адамның бейнеүлгісімен салыстырып, қимылды қайталаңыз."),
                        ][i]
                      }
                    </p>
                  </div>
                  <ArrowUpRight size={20} />
                </button>
              ))}
            </div>
            <div
              className="experience-preview"
              id="stage-preview"
              role="tabpanel"
              aria-labelledby={`stage-tab-${step}`}
            >
              <div className="preview-top">
                <span>
                  <i />
                  <i />
                  <i />
                </span>
                <small>{t("Интерактивный пример")}</small>
              </div>
              <div className="preview-body" key={step}>
                {step === 0 ? (
                  <>
                    <div className="upload-illustration">
                      <FileText size={54} />
                      <span>РЖЯ / 01</span>
                      <Check size={18} />
                    </div>
                    <h3>{t("С чего начнём?")}</h3>
                    <p>
                      {at("В первой пробе доступна фраза «Как тебя зовут?». Другие темы будем добавлять после проверки анимаций специалистом.", "The first prototype offers “What is your name?”. More topics will follow after specialist review of the animations.", "Алғашқы нұсқада «Сенің атың кім?» сөйлемі бар. Басқа тақырыптар анимацияларды маман тексергеннен кейін қосылады.")}
                    </p>
                    <div className="preview-tags">
                      <span>РЖЯ</span>
                      <span>3D</span>
                      <span>0.25×</span>
                      <span>360°</span>
                    </div>
                  </>
                ) : step === 1 ? (
                  <>
                    <div className="preview-avatar">
                      <AvatarPlayer avatarId="classic-female" compact style="violet" state="speaking" />
                    </div>
                    <h3>{at("Сначала посмотрите движение целиком.", "Watch the whole movement first.", "Алдымен қимылды толық қараңыз.")}</h3>
                    <p>
                      {at("Откройте 3D-пример: можно смотреть спереди, сбоку и под углом. Темп анимации выбираете вы.", "Open the 3D preview for front, side and angled views. Choose the animation speed yourself.", "3D үлгісін ашып, алдынан, жанынан және бұрыштан қараңыз. Анимация қарқынын өзіңіз таңдаңыз.")}
                    </p>
                    <div className="preview-progress">
                      <span />
                    </div>
                  </>
                ) : step === 2 ? (
                  <>
                    <div className="preview-avatar">
                      <AvatarPlayer
                        compact
                        avatarId="classic-female"
                        style="violet"
                        state="speaking"
                      />
                    </div>
                    <div className="preview-question">
                      <Mic size={16} />
                      {at("Покажи по шагам", "Show it step by step", "Қадам бойынша көрсет")}
                    </div>
                    <p>
                      {at("Рассмотрите кисти крупным планом. Важно заметить, какие пальцы участвуют и куда направлена ладонь.", "Inspect the hands close up. Notice which fingers are involved and the direction the palm faces.", "Қолдарды жақыннан қараңыз. Қай саусақтар қатысатынын және алақан бағытын байқаңыз.")}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="practice-illustration">
                      <BookOpen size={36} />
                      <CheckCheck size={30} />
                      <GraduationCap size={36} />
                    </div>
                    <h3>{t("Теперь попробуйте сами")}</h3>
                    <p>
                      {at("Попробуйте повторить фразу без подсказки, затем снова посмотрите оригинальное видео. Пока платформа не оценивает правильность ваших движений.", "Try the phrase without a hint, then watch the original video again. The platform does not yet assess the accuracy of your movements.", "Сөйлемді көмексіз қайталап, түпнұсқа бейнені қайта қараңыз. Платформа қимылдарыңыздың дұрыстығын әзірге бағаламайды.")}
                    </p>
                    <div className="preview-tags">
                      <span>{at("Наблюдение", "Observation", "Бақылау")}</span>
                      <span>{at("Повторение", "Repetition", "Қайталау")}</span>
                      <span>{t("Практика")}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
        <section
          id="for-you"
          className="mentor-section audience-section"
          data-reveal
        >
          <div className="mentor-section-heading">
            <span className="mentor-kicker">03 / {t("Для кого")}</span>
            <h2>
              {t("Разные роли.")}
              <br />
              <span>{t("Общая цель — понять.")}</span>
            </h2>
          </div>
          <div
            className="audience-switch"
            role="group"
            aria-label={t("Кому подходит платформа")}
          >
            <button
              aria-pressed={audience === "student"}
              onClick={() => setAudience("student")}
            >
              {t("Студентам")}
            </button>
            <button
              aria-pressed={audience === "teacher"}
              onClick={() => setAudience("teacher")}
            >
              {t("Преподавателям")}
            </button>
          </div>
          <div className="audience-content" key={audience}>
            <div className="audience-copy">
              <h3>
                {audience === "student"
                  ? at("Учитесь общаться по-новому.", "Discover a new way to communicate.", "Қарым-қатынастың жаңа жолын үйреніңіз.")
                  : at("Ваш опыт делает обучение точнее.", "Your expertise makes learning more accurate.", "Сіздің тәжірибеңіз оқуды нақтылайды.")}
              </h3>
              <p>
                {audience === "student"
                  ? at("Для тех, кто хочет начать знакомство с РЖЯ: смотреть жесты, замечать детали и возвращаться к сложным движениям столько раз, сколько нужно.", "For anyone starting to explore RSL: watch signs, notice details and revisit difficult movements as often as needed.", "Орыс ым тілімен танысуды бастағысы келетіндерге: ымдарды қарау, бөлшектерін байқау және күрделі қимылдарды қайталау.")
                  : at("В развитии проекта особенно важны преподаватели и носители РЖЯ. Вместе с ними нужно проверить форму кистей, направление движений и мимику, прежде чем превращать прототипы в учебные уроки.", "RSL teachers and signers are essential to this project. Hand shapes, movement direction and facial expression need their review before prototypes become teaching materials.", "Жобаға орыс ым тілі оқытушылары мен қолданушылары қажет. Прототиптерді оқу материалына айналдырмас бұрын қол пішіні, қимыл бағыты және мимика тексерілуі тиіс.")}
              </p>
              <ul>
                {(audience === "student"
                  ? [
                      at("Просмотр жестов с разных ракурсов", "Signs viewed from multiple angles", "Ымдарды түрлі ракурстан көру"),
                      at("Замедление и разбор по шагам", "Slow motion and step-by-step viewing", "Баяулату және қадам бойынша талдау"),
                      at("Самостоятельное повторение по видеообразцу", "Independent practice with a reference video", "Бейнеүлгімен өз бетімен қайталау"),
                    ]
                  : [
                      at("Экспертная проверка учебных жестов", "Expert review of learning signs", "Оқу ымдарын сарапшылық тексеру"),
                      at("Подбор фраз для начинающих", "Selecting phrases for beginners", "Жаңадан үйренушілерге сөйлем таңдау"),
                      at("Совместная разработка будущих уроков", "Developing future lessons together", "Болашақ сабақтарды бірге әзірлеу"),
                    ]
                ).map((item) => (
                  <li key={item}>
                    <Check size={17} />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to={user ? "/dashboard" : "/register"}
                className="mentor-text-link"
              >
                {audience === "student"
                  ? t("Начать учиться")
                  : t("Создать аккаунт")}
                <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="audience-art">
              <div className="audience-art-ring" />
              <AvatarPlayer
                compact
                avatarId="classic-female"
                style="violet"
              />
              <span>
                {audience === "teacher"
                  ? t("Ваш преподаватель")
                  : t("Ваш темп")}
              </span>
            </div>
          </div>
        </section>
        <LearningGallery />
        <section className="mentor-language-section" data-reveal>
          <div>
            <span className="mentor-kicker">RU / EN / KZ</span>
            <h2>{t("Ближе на вашем языке.")}</h2>
            <p>
              {at("Интерфейс можно переключить на русский, английский или казахский. Демонстрируемый жестовый язык остаётся русским жестовым языком: перевод меню не меняет сами жесты.", "Choose Russian, English or Kazakh for the interface. The demonstration remains in Russian Sign Language: translating the menus does not change the signs.", "Интерфейсті орыс, ағылшын немесе қазақ тіліне ауыстыруға болады. Көрсетілім орыс ым тілінде қалады: мәзір аудармасы ымдарды өзгертпейді.")}
            </p>
          </div>
          <div className="language-art" aria-hidden="true">
            <span>Понимать.</span>
            <span>Understand.</span>
            <span>Түсіну.</span>
          </div>
        </section>
        <section
          id="questions"
          className="mentor-section mentor-faq"
          data-reveal
        >
          <div className="mentor-section-heading">
            <span className="mentor-kicker">04 / FAQ</span>
            <h2>{t("Остались вопросы?")}</h2>
            <p>{t("Вот что полезно знать перед первым занятием.")}</p>
          </div>
          <div>
            {[
              [at("Как начать?", "How do I start?", "Қалай бастауға болады?"), at("Откройте «Посмотреть жесты аватара». Сейчас доступна пробная 3D-анимация фразы «Как тебя зовут?».", "Open Explore the signing avatar. A trial 3D animation of “What is your name?” is currently available.", "«Аватардың ымдарын көру» сілтемесін ашыңыз. Қазір «Сенің атың кім?» сынақ 3D анимациясы бар.")],
              [at("Какой жестовый язык используется?", "Which sign language is used?", "Қай ым тілі қолданылады?"), at("Русский жестовый язык — РЖЯ. Переключение языка интерфейса не меняет язык демонстрации.", "Russian Sign Language (RSL). Switching the interface language does not change the language demonstrated.", "Орыс ым тілі қолданылады. Интерфейс тілін ауыстыру көрсетілім тілін өзгертпейді.")],
              [at("Можно замедлить аватара?", "Can I slow the avatar down?", "Аватарды баяулатуға бола ма?"), at("Да. В 3D-примере доступны пауза, скорость 0.25× и 0.5×, просмотр по шагам и приближение кистей.", "Yes. The 3D prototype supports pause, 0.25× and 0.5× speed, step-by-step viewing and hand close-ups.", "Иә. 3D үлгісінде кідіріс, 0.25× және 0.5× қарқын, қадаммен көру және қолдарды үлкейту бар.")],
              [at("Это уже полноценный курс?", "Is this a complete course?", "Бұл толық курс па?"), at("Пока нет. Анимация — прототип, её форму кистей, направление движения и мимику ещё должен проверить носитель РЖЯ. Для обучения сверяйтесь с видеообразцом человека.", "Not yet. The animation is a prototype: an RSL signer still needs to review hand shapes, movement and facial expression. Use the human reference video when learning.", "Әзірге жоқ. Анимация — прототип: қол пішіні, қимыл және мимиканы маман тексеруі керек. Үйрену үшін адамның бейнеүлгісіне сүйеніңіз.")],
              [at("Где здесь AI-компонент?", "Where is the AI component?", "AI компоненті қайда?"), at("В тренажёре работает пилотный классификатор букв А, В, Л, обученный на Bukva. Он обрабатывает фото или камеру на вашем устройстве без API-ключей. Распознавание слов и фраз ещё не обучено.", "The practice room includes a pilot classifier trained on Bukva for А, В, Л. It processes photos or camera frames on your device without API keys. Word and phrase recognition is not trained yet.", "Жаттығуда Bukva деректерінде оқытылған А, В, Л классификаторы бар. Фото мен камера кадрларын құрылғыда API кілтінсіз өңдейді. Сөздер мен сөйлемдерді тану әлі оқытылмаған.")],
              [at("Нужны ли API-ключи для просмотра жестов?", "Do I need API keys to view signs?", "Ымдарды көруге API кілті керек пе?"), at("Нет. Подготовленная 3D-анимация проигрывается в браузере. Камера для её просмотра тоже не нужна.", "No. The prepared 3D animation plays in the browser. You do not need a camera to watch it.", "Жоқ. Дайын 3D анимация браузерде ойнатылады. Көру үшін камера да қажет емес.")]
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <Plus size={20} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="mentor-final" data-reveal>
          <div className="mentor-final-orbit" aria-hidden="true" />
          <span className="mentor-kicker">AI MENTOR</span>
          <h2>
            {t("Ваш следующий")}
            <br />
            <span>{t("момент понимания.")}</span>
          </h2>
          <p>{at("Начните со знакомства — посмотрите первую фразу на РЖЯ.", "Start with an introduction: explore your first RSL phrase.", "Танысудан бастаңыз — орыс ым тіліндегі алғашқы сөйлемді қараңыз.")}</p>
          <Link to={destination} className="mentor-cta">
            {user ? t("В кабинет") : t("Создать аккаунт")}
            <ArrowUpRight size={20} />
          </Link>
        </section>
      </main>
      <footer className="mentor-footer">
        <div>
          <Link to="/">
            <Brand />
          </Link>
          <p>{at("Язык жестов. Больше способов понимать друг друга.", "Sign language. More ways to understand each other.", "Ым тілі. Бір-бірімізді түсінудің жаңа жолдары.")}</p>
        </div>
        <div className="mentor-footer-links">
          <a href="#possibilities">{t("Возможности")}</a>
          <a href="#experience">{t("Как это работает")}</a>
          <a href="#questions">FAQ</a>
          <Link to={user ? "/dashboard" : "/login"}>
            {user ? t("В кабинет") : t("Войти")}
          </Link>
        </div>
        <LanguageSwitcher />
        <div className="mentor-footer-bottom">
          <span>© AI Mentor</span>
          <span>{at("Смотрите. Повторяйте. Понимайте.", "Watch. Practise. Understand.", "Қараңыз. Қайталаңыз. Түсініңіз.")}</span>
        </div>
      </footer>
    </div>
  );
}
