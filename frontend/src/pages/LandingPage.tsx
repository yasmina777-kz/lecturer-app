import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  Play,
  Plus,
} from "lucide-react";
import { ProductSurface } from "../components/ProductSurface";
import "./landing-page.css";
import "./landing-reference.css";
import "./landing-motion.css";
import "./landing-refresh.css";
import { Brand } from "../components/UI";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n";
import { at } from "../i18n/automation";
import { ProjectStory, ProjectDetails } from "../components/ProjectStory";
import { LearningGallery } from "../components/LearningGallery";
export default function LandingPage() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [motionPaused, setMotionPaused] = useState(false);
  const [audience, setAudience] = useState<"student" | "teacher">("student");
  const root = useRef<HTMLDivElement>(null);
  // Hero photo variants for comparison: /?hero=reach|dialog|hold|meadow
  const heroScene = (() => {
    const v = new URLSearchParams(window.location.search).get("hero");
    return v && ["reach", "dialog", "hold", "meadow"].includes(v) ? v : "reach";
  })();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const ids = ["about-project", "languages", "possibilities", "experience", "for-you"];
    const spy = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        }),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) spy.observe(el);
    });
    return () => spy.disconnect();
  }, []);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          entry.target.classList.toggle("in-view", entry.isIntersecting);
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          }
        }),
      { threshold: 0.08, rootMargin: "0px" },
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
    <ProductSurface className="landing-surface">
      <div
        className={`landing-site${motionPaused ? " motion-paused" : ""}`}
        ref={root}
      >
        <header className={`mentor-header${scrolled ? " is-scrolled" : ""}`}>
          <Link to="/" aria-label="AI Mentor">
            <Brand />
          </Link>
          <nav aria-label={t("Навигация по сайту")}>
            <a href="#languages" className={active === "languages" ? "is-active" : undefined}>{at("Два языка", "Two languages", "Екі тіл")}</a>
            <a href="#possibilities" className={active === "possibilities" ? "is-active" : undefined}>{t("Возможности")}</a>
            <a href="#about-project" className={active === "about-project" ? "is-active" : undefined}>
              {at("О проекте", "About", "Жоба туралы")}
            </a>
            <a href="#experience" className={active === "experience" ? "is-active" : undefined}>{t("Как это работает")}</a>
            <a href="#for-you" className={active === "for-you" ? "is-active" : undefined}>{t("Для кого")}</a>
          </nav>
          <div className="mentor-header-actions">
            <ThemeSwitcher />
            <details className="landing-language-menu">
              <summary>
                {at("RU", "EN", "KZ")} <span aria-hidden="true">⌄</span>
              </summary>
              <LanguageSwitcher />
            </details>
            <Link className="mentor-signin" to={destination}>
              {user ? t("В кабинет") : t("Начать обучение")}
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </header>
        <main>
          <section className="lp-hero">
            <div className={`lp-scene lp-scene--${heroScene}`}>
              <img className="lp-scene-img" src={`/images/landing-v2/hero-${heroScene}.webp`} alt="" />
              <div className="lp-scene-copy">
                <h1>
                  {at("Понимать друг друга\nбез слов", "Understand each other\nwithout words", "Бірін-бірі\nсөзсіз түсіну")}
                </h1>
                <p>
                  {at(
                    "Короткие уроки с носителями языка, 3D-аватар, которого можно замедлить и повернуть, и камера, которая подскажет, верно ли вы показали жест.",
                    "Short lessons with native signers, a 3D avatar you can slow down and rotate, and a camera that tells you whether your sign is right.",
                    "Ана тілі иелерімен қысқа сабақтар, баяулатып әрі бұруға болатын 3D-аватар және ымды дұрыс көрсеткеніңізді айтатын камера.",
                  )}
                </p>
                <div className="lp-actions">
                  <Link to={destination} className="lp-cta">
                    {user ? t("Продолжить обучение") : at("Начать бесплатно", "Start learning", "Оқуды бастау")}
                    <ArrowUpRight size={18} />
                  </Link>
                  <a href="#experience" className="lp-ghost">
                    <Play size={14} />
                    {at("Как проходит урок", "How a lesson works", "Сабақ қалай өтеді")}
                  </a>
                </div>
              </div>
            </div>
          </section>
          <div className="mentor-format-strip">
            <span>
              {at(
                "Новый способ изучать язык жестов.",
                "A new way to explore sign language.",
                "Ым тілін үйренудің жаңа тәсілі.",
              )}
            </span>
            <div>
              <FileText size={15} />
              РЖЯ · ҚЖЯ
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
          <section id="languages" className="mentor-section languages-section" data-reveal>
            <div className="mentor-section-heading">
              <span className="mentor-kicker">
                {at("Два языка — одна платформа", "Two languages, one platform", "Екі тіл — бір платформа")}
              </span>
              <h2>
                {at("Русский и казахский", "Russian and Kazakh", "Орыс және қазақ")}
                <br />
                <span>
                  {at("жестовые языки в одном месте.", "sign languages in one place.", "ым тілдері бір жерде.")}
                </span>
              </h2>
              <p>
                {at(
                  "Переключатель РЖЯ / ҚЖЯ меняет уроки, словарь, азбуку, диалоги и ИИ-проверку. Учите один язык или оба сразу.",
                  "The РЖЯ / ҚЖЯ switch changes lessons, dictionary, alphabet, dialogues and the AI check. Learn one language or both.",
                  "РЖЯ / ҚЖЯ ауыстырғышы сабақтарды, сөздікті, әліпбиді, диалогтарды және ЖИ тексеруін өзгертеді. Бір тілді немесе екеуін бірге үйреніңіз.",
                )}
              </p>
            </div>
            <div className="languages-grid">
              {[
                {
                  code: "РЖЯ",
                  name: at("Русский жестовый язык", "Russian Sign Language", "Орыс ым тілі"),
                  stats: [
                    ["33", at("буквы азбуки", "alphabet letters", "әліпби әрпі")],
                    ["1000", at("слов знает ИИ", "words the AI knows", "сөзді ЖИ таниды")],
                  ],
                  items: [
                    at("Уроки по темам с видео носителей (Slovo, Bukva)", "Topic lessons with native-signer videos (Slovo, Bukva)", "Ым иелерінің бейнелерімен тақырыптық сабақтар (Slovo, Bukva)"),
                    at("ИИ-проверка букв и слов камерой", "Camera AI check of letters and words", "Әріптер мен сөздерді камерамен ЖИ тексеруі"),
                    at("Диалоги на бытовые темы", "Everyday dialogues", "Күнделікті тақырыптағы диалогтар"),
                    at("3D-аватар: пауза, замедление, поворот", "3D avatar: pause, slow motion, rotation", "3D аватар: кідіріс, баяулату, бұру"),
                  ],
                },
                {
                  code: "ҚЖЯ",
                  name: at("Казахский жестовый язык", "Kazakh Sign Language", "Қазақ ым тілі"),
                  stats: [
                    ["42", at("буквы азбуки", "alphabet letters", "әліпби әрпі")],
                    ["751", at("жест словаря SURDO.KZ", "signs from SURDO.KZ", "SURDO.KZ ымы")],
                  ],
                  items: [
                    at("Уроки по темам: каждое слово показывает носитель", "Topic lessons: every word shown by a native signer", "Тақырыптық сабақтар: әр сөзді ым иесі көрсетеді"),
                    at("Видеоуроки преподавателей «Саусақтар сөйлейді» и фразы «Оян, Qazaqstan»", "Teacher video lessons «Саусақтар сөйлейді» and «Оян, Qazaqstan» phrases", "«Саусақтар сөйлейді» бейнесабақтары және «Оян, Qazaqstan» сөйлемдері"),
                    at("3 диалога: камера проверяет вашу реплику", "3 dialogues: the camera checks your reply", "3 диалог: камера жауабыңызды тексереді"),
                    at("ИИ узнаёт 736 слов, 12 фраз и казахские буквы", "The AI knows 736 words, 12 phrases and Kazakh letters", "ЖИ 736 сөзді, 12 сөйлемді және қазақ әріптерін таниды"),
                  ],
                },
              ].map((lang) => (
                <article className="language-card" key={lang.code}>
                  <header>
                    <span className="language-code">{lang.code}</span>
                    <h3>{lang.name}</h3>
                  </header>
                  <div className="language-stats">
                    {lang.stats.map(([n, label]) => (
                      <div key={label}>
                        <strong>{n}</strong>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                  <ul>
                    {lang.items.map((item) => (
                      <li key={item}>
                        <Check size={17} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link to={destination} className="mentor-text-link">
                    {user ? at("Открыть уроки", "Open lessons", "Сабақтарды ашу") : at("Начать бесплатно", "Start for free", "Тегін бастау")}
                    <ArrowUpRight size={18} />
                  </Link>
                </article>
              ))}
            </div>
            <p className="languages-note">
              {at(
                "Распознавание работает прямо в браузере: видео с камеры никуда не отправляется.",
                "Recognition runs right in your browser: camera video never leaves your device.",
                "Тану браузердің ішінде жұмыс істейді: камера бейнесі ешқайда жіберілмейді.",
              )}
            </p>
          </section>
          <section id="possibilities" className="mentor-section" data-reveal>
            <div className="mentor-section-heading">
              <span className="mentor-kicker">
                {at("Ваш путь", "Your path", "Оқу жолыңыз")}
              </span>
              <h2>
                {at(
                  "От первых жестов",
                  "From your first signs",
                  "Алғашқы ымдардан",
                )}
                <br />
                <span>
                  {at(
                    "к общению без слов.",
                    "to communication without speech.",
                    "сөзсіз қарым-қатынасқа.",
                  )}
                </span>
              </h2>
              <p>
                {at(
                  "Новая идея платформы — обучение через наблюдение и повторение. Аватар помогает рассмотреть движение, а видеообразец человека — свериться с оригиналом.",
                  "The new idea is learning through observation and practice. The avatar helps you inspect a movement, while a human reference video lets you compare it with the original.",
                  "Платформаның жаңа идеясы — бақылау және қайталау арқылы үйрену. Аватар қимылды қарауға, ал адамның бейнеүлгісі түпнұсқамен салыстыруға көмектеседі.",
                )}
              </p>
            </div>
            <div className="feature-stories">
              {[
                {
                  image: "rsl-units/03",
                  step: 1,
                  title: at(
                    "Буквы и дактиль",
                    "Letters and fingerspelling",
                    "Әріптер мен дактиль",
                  ),
                  text: at(
                    "В пробной демонстрации можно повернуть 3D-аватара, приблизить кисти и рассмотреть положение пальцев.",
                    "Rotate the 3D avatar in the prototype, zoom in on the hands and inspect finger positions.",
                    "Сынақ көрсетілімінде 3D аватарды бұрып, қолдарды үлкейтіп, саусақ қалпын қарауға болады.",
                  ),
                  action: at(
                    "Посмотреть занятие",
                    "Explore a lesson",
                    "Сабақты көру",
                  ),
                  alt: at(
                    "Открытая книга с объёмными учебными иллюстрациями",
                    "An open book with three-dimensional learning illustrations",
                    "Көлемді оқу иллюстрациялары бар ашық кітап",
                  ),
                },
                {
                  image: "rsl-units/01",
                  step: 2,
                  title: at(
                    "Первые слова",
                    "Your first words",
                    "Алғашқы сөздер",
                  ),
                  text: at(
                    "Остановите анимацию на нужном кадре или замедлите её. Рассмотрите направление движения и переход между частями фразы.",
                    "Pause on a frame or slow the animation down. Inspect the direction and transition between parts of the phrase.",
                    "Анимацияны қажетті кадрда тоқтатыңыз немесе баяулатыңыз. Қимыл бағыты мен сөйлем бөліктерінің ауысуын қараңыз.",
                  ),
                  action: at(
                    "Как устроен разбор",
                    "Explore the breakdown",
                    "Талдауды көру",
                  ),
                  alt: at(
                    "Преподаватель объясняет студенту тему",
                    "A teacher explaining a topic to a student",
                    "Оқытушы студентке тақырыпты түсіндіріп жатыр",
                  ),
                },
                {
                  image: "rsl-units/25",
                  step: 3,
                  title: at(
                    "Фразы и знакомство",
                    "Phrases and introductions",
                    "Сөйлемдер мен танысу",
                  ),
                  text: at(
                    "Повторите фразу и проверьте себя камерой: ИИ узнаёт буквы и слова на РЖЯ и ҚЖЯ, а в казахских диалогах — целые реплики.",
                    "Repeat the phrase and check yourself with the camera: the AI recognizes letters and words in RSL and KSL, and whole replies in the Kazakh dialogues.",
                    "Сөйлемді қайталап, өзіңізді камерамен тексеріңіз: ЖИ РЖЯ мен ҚЖЯ әріптері мен сөздерін, ал қазақ диалогтарында тұтас жауаптарды таниды.",
                  ),
                  action: at(
                    "Посмотреть практику",
                    "Explore practice",
                    "Жаттығуды көру",
                  ),
                  alt: at(
                    "Ступени с книгами ведут вверх вокруг стеклянной сферы",
                    "Steps with books rise around a glass sphere",
                    "Кітаптары бар баспалдақтар шыны шарды айнала жоғары көтеріледі",
                  ),
                },
              ].map(({ image, step: stage, title, text, action }, i) => (
                <article className="feature-story" key={image}>
                  <div className="feature-story-image">
                    <img
                      src={`/images/${image}.webp`}
                      width="1536"
                      height="1024"
                      loading="lazy"
                      decoding="async"
                      alt=""
                    />
                    <span className="feature-story-number">0{i + 1}</span>
                  </div>
                  <div className="feature-story-copy">
                    <h3>{title}</h3>
                    <p>
                      {
                        [
                          at(
                            "Освойте дактильный алфавит и базовые принципы жестов.",
                            "Explore fingerspelling and the basics of signs.",
                            "Дактиль әліпбиі мен ым негіздерін үйреніңіз.",
                          ),
                          at(
                            "Изучайте повседневные слова и простые фразы.",
                            "Explore everyday words and simple phrases.",
                            "Күнделікті сөздер мен қарапайым сөйлемдерді үйреніңіз.",
                          ),
                          at(
                            "Знакомьтесь и пробуйте общаться без слов.",
                            "Introduce yourself and try communicating without words.",
                            "Танысып, сөзсіз сөйлесіп көріңіз.",
                          ),
                        ][i]
                      }
                    </p>
                    <details className="feature-more">
                      <summary>
                        {at("Подробнее", "Details", "Толығырақ")}
                      </summary>
                      <p>{text}</p>
                    </details>
                    <a href="#experience" onClick={() => setStep(stage)}>
                      {action}
                      <ArrowUpRight size={17} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <ProjectStory destination={destination} />
          <section
            id="experience"
            className="mentor-section experience-section"
            data-reveal
          >
            <div className="mentor-section-heading">
              <span className="mentor-kicker">
                02 / {t("Как это работает")}
              </span>
              <h2>
                {at(
                  "От первого жеста",
                  "From your first sign",
                  "Алғашқы ымнан",
                )}
                <br />
                <span>
                  {at(
                    "к первому знакомству.",
                    "to your first introduction.",
                    "алғашқы танысуға.",
                  )}
                </span>
              </h2>
              <p>
                {at(
                  "Переключите этапы, чтобы познакомиться с новым сценарием обучения: увидеть жест, разобраться в деталях и попробовать повторить.",
                  "Switch steps to explore the new learning flow: watch a sign, inspect the details and try it yourself.",
                  "Жаңа оқу жолын көру үшін кезеңдерді ауыстырыңыз: ымды көру, бөлшектерін түсіну және қайталау.",
                )}
              </p>
            </div>
            <Link to="/gesture-preview" className="module-launch mentor-cta">
              {at("Посмотреть модуль", "Explore the module", "Модульді көру")}
              <ArrowRight size={18} />
            </Link>
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
                            at(
                              "Начните со знакомства: «Как тебя зовут?»",
                              "Start with an introduction: “What is your name?”",
                              "«Сенің атың кім?» сөйлемінен бастаңыз.",
                            ),
                            at(
                              "В отдельной 3D-демонстрации аватар показывает фразу.",
                              "The avatar demonstrates a phrase in the separate 3D preview.",
                              "Аватар бөлек 3D көрсетілімінде сөйлемді көрсетеді.",
                            ),
                            at(
                              "Пауза, замедление и разные ракурсы помогают увидеть детали.",
                              "Pause, slow motion and different views help reveal details.",
                              "Кідіріс, баяулату және түрлі ракурстар бөлшектерді көруге көмектеседі.",
                            ),
                            at(
                              "Повторите движение, сверяясь с видеообразцом человека.",
                              "Practise the movement using the human reference video.",
                              "Адамның бейнеүлгісімен салыстырып, қимылды қайталаңыз.",
                            ),
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
                      <img
                        className="stage-hand"
                        src="/images/landing-v2/mentor-wave.webp"
                        alt=""
                      />
                      <h3>{t("С чего начнём?")}</h3>
                      <details className="stage-details">
                        <summary>
                          {at(
                            "Об этом этапе",
                            "About this step",
                            "Осы кезең туралы",
                          )}
                        </summary>
                        <p>
                          {at(
                            "В первой пробе доступна фраза «Как тебя зовут?». Другие темы будем добавлять после проверки анимаций специалистом.",
                            "The first prototype offers “What is your name?”. More topics will follow after specialist review of the animations.",
                            "Алғашқы нұсқада «Сенің атың кім?» сөйлемі бар. Басқа тақырыптар анимацияларды маман тексергеннен кейін қосылады.",
                          )}
                        </p>
                      </details>
                      <div className="preview-tags">
                        <span>РЖЯ</span>
                        <span>3D</span>
                        <span>0.25×</span>
                        <span>360°</span>
                      </div>
                    </>
                  ) : step === 1 ? (
                    <>
                      <img
                        className="stage-hand"
                        src="/images/landing-v2/mentor-wave.webp"
                        alt=""
                      />
                      <h3>
                        {at(
                          "Сначала посмотрите движение целиком.",
                          "Watch the whole movement first.",
                          "Алдымен қимылды толық қараңыз.",
                        )}
                      </h3>
                      <details className="stage-details">
                        <summary>
                          {at(
                            "Об этом этапе",
                            "About this step",
                            "Осы кезең туралы",
                          )}
                        </summary>
                        <p>
                          {at(
                            "Откройте 3D-пример: можно смотреть спереди, сбоку и под углом. Темп анимации выбираете вы.",
                            "Open the 3D preview for front, side and angled views. Choose the animation speed yourself.",
                            "3D үлгісін ашып, алдынан, жанынан және бұрыштан қараңыз. Анимация қарқынын өзіңіз таңдаңыз.",
                          )}
                        </p>
                      </details>
                      <div className="preview-progress">
                        <span />
                      </div>
                    </>
                  ) : step === 2 ? (
                    <>
                      <img
                        className="stage-hand stage-photo"
                        src="/images/landing-v2/hands-detail.webp"
                        alt=""
                      />
                      <h3>
                        {at(
                          "Покажи по шагам",
                          "Show it step by step",
                          "Қадам бойынша көрсет",
                        )}
                      </h3>
                      <details className="stage-details">
                        <summary>
                          {at(
                            "Об этом этапе",
                            "About this step",
                            "Осы кезең туралы",
                          )}
                        </summary>
                        <p>
                          {at(
                            "Рассмотрите кисти крупным планом. Важно заметить, какие пальцы участвуют и куда направлена ладонь.",
                            "Inspect the hands close up. Notice which fingers are involved and the direction the palm faces.",
                            "Қолдарды жақыннан қараңыз. Қай саусақтар қатысатынын және алақан бағытын байқаңыз.",
                          )}
                        </p>
                      </details>
                    </>
                  ) : (
                    <>
                      <img
                        className="stage-hand"
                        src="/images/landing-v2/practice.webp"
                        alt=""
                      />
                      <h3>{t("Теперь попробуйте сами")}</h3>
                      <details className="stage-details">
                        <summary>
                          {at(
                            "Об этом этапе",
                            "About this step",
                            "Осы кезең туралы",
                          )}
                        </summary>
                        <p>
                          {at(
                            "Попробуйте повторить фразу без подсказки, затем снова посмотрите оригинальное видео. Пока платформа не оценивает правильность ваших движений.",
                            "Try the phrase without a hint, then watch the original video again. The platform does not yet assess the accuracy of your movements.",
                            "Сөйлемді көмексіз қайталап, түпнұсқа бейнені қайта қараңыз. Платформа қимылдарыңыздың дұрыстығын әзірге бағаламайды.",
                          )}
                        </p>
                      </details>
                      <div className="preview-tags">
                        <span>
                          {at("Наблюдение", "Observation", "Бақылау")}
                        </span>
                        <span>
                          {at("Повторение", "Repetition", "Қайталау")}
                        </span>
                        <span>{t("Практика")}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
          <details className="platform-disclosure">
            <summary>
              {at(
                "Подробнее о возможностях платформы",
                "Explore the platform features",
                "Платформа мүмкіндіктері туралы",
              )}
              <Plus size={18} />
            </summary>
            <ProjectDetails />
          </details>
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
                    ? at(
                        "Учитесь общаться по-новому.",
                        "Discover a new way to communicate.",
                        "Қарым-қатынастың жаңа жолын үйреніңіз.",
                      )
                    : at(
                        "Ваш опыт делает обучение точнее.",
                        "Your expertise makes learning more accurate.",
                        "Сіздің тәжірибеңіз оқуды нақтылайды.",
                      )}
                </h3>
                <p>
                  {audience === "student"
                    ? at(
                        "Для тех, кто хочет начать знакомство с русским (РЖЯ) или казахским (ҚЖЯ) жестовым языком: смотреть жесты носителей, замечать детали и возвращаться к сложным движениям столько раз, сколько нужно.",
                        "For anyone starting Russian (RSL) or Kazakh (KSL) Sign Language: watch native signers, notice details and revisit difficult movements as often as needed.",
                        "Орыс (ОЫТ) немесе қазақ (ҚЫТ) ым тілімен танысуды бастағысы келетіндерге: ым иелерінің бейнелерін қарау, бөлшектерін байқау және күрделі қимылдарды қайталау.",
                      )
                    : at(
                        "В развитии проекта особенно важны преподаватели и носители РЖЯ и казахского жестового языка. Вместе с ними нужно проверить форму кистей, направление движений и мимику, прежде чем превращать прототипы в учебные уроки.",
                        "RSL and Kazakh SL teachers and signers are essential to this project. Hand shapes, movement direction and facial expression need their review before prototypes become teaching materials.",
                        "Жобаға орыс және қазақ ым тілдерінің оқытушылары мен қолданушылары қажет. Прототиптерді оқу материалына айналдырмас бұрын қол пішіні, қимыл бағыты және мимика тексерілуі тиіс.",
                      )}
                </p>
                <ul>
                  {(audience === "student"
                    ? [
                        at(
                          "Просмотр жестов с разных ракурсов",
                          "Signs viewed from multiple angles",
                          "Ымдарды түрлі ракурстан көру",
                        ),
                        at(
                          "Замедление и разбор по шагам",
                          "Slow motion and step-by-step viewing",
                          "Баяулату және қадам бойынша талдау",
                        ),
                        at(
                          "Самостоятельное повторение по видеообразцу",
                          "Independent practice with a reference video",
                          "Бейнеүлгімен өз бетімен қайталау",
                        ),
                      ]
                    : [
                        at(
                          "Экспертная проверка учебных жестов",
                          "Expert review of learning signs",
                          "Оқу ымдарын сарапшылық тексеру",
                        ),
                        at(
                          "Подбор фраз для начинающих",
                          "Selecting phrases for beginners",
                          "Жаңадан үйренушілерге сөйлем таңдау",
                        ),
                        at(
                          "Совместная разработка будущих уроков",
                          "Developing future lessons together",
                          "Болашақ сабақтарды бірге әзірлеу",
                        ),
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
                <img
                  src={`/images/landing-v2/${audience === "student" ? "mentor-wave" : "mentor-pointing"}.webp`}
                  alt=""
                  loading="lazy"
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
                [
                  at(
                    "Как начать?",
                    "How do I start?",
                    "Қалай бастауға болады?",
                  ),
                  at(
                    "Создайте аккаунт, выберите язык переключателем РЖЯ / ҚЖЯ и откройте первый урок. Без регистрации можно посмотреть 3D-аватара.",
                    "Create an account, pick a language with the РЖЯ / ҚЖЯ switch and open the first lesson. The 3D avatar is available without signing up.",
                    "Аккаунт ашып, РЖЯ / ҚЖЯ ауыстырғышымен тілді таңдаңыз да, алғашқы сабақты ашыңыз. 3D аватарды тіркелмей-ақ көруге болады.",
                  ),
                ],
                [
                  at(
                    "Какой жестовый язык используется?",
                    "Which sign language is used?",
                    "Қай ым тілі қолданылады?",
                  ),
                  at(
                    "Два: русский жестовый язык (РЖЯ; видео носителей из Slovo и Bukva) и казахский жестовый язык (ҚЖЯ; 751 жест из словаря SURDO.KZ, казахский дактиль из 42 букв). Выбор — переключателем РЖЯ / ҚЖЯ.",
                    "Two: Russian Sign Language (RSL; native-signer videos from Slovo and Bukva) and Kazakh Sign Language (KSL; 751 signs from the SURDO.KZ dictionary, 42-letter Kazakh fingerspelling). Use the РЖЯ / ҚЖЯ switch.",
                    "Екеуі: орыс ым тілі (ОЫТ; Slovo мен Bukva бейнелері) және қазақ ым тілі (ҚЫТ; SURDO.KZ сөздігінен 751 ым, 42 әріпті қазақ дактилі). Таңдау — РЖЯ / ҚЖЯ ауыстырғышымен.",
                  ),
                ],
                [
                  at(
                    "Можно замедлить аватара?",
                    "Can I slow the avatar down?",
                    "Аватарды баяулатуға бола ма?",
                  ),
                  at(
                    "Да. В 3D-примере доступны пауза, скорость 0.25× и 0.5×, просмотр по шагам и приближение кистей.",
                    "Yes. The 3D prototype supports pause, 0.25× and 0.5× speed, step-by-step viewing and hand close-ups.",
                    "Иә. 3D үлгісінде кідіріс, 0.25× және 0.5× қарқын, қадаммен көру және қолдарды үлкейту бар.",
                  ),
                ],
                [
                  at(
                    "Это уже полноценный курс?",
                    "Is this a complete course?",
                    "Бұл толық курс па?",
                  ),
                  at(
                    "Для обоих языков уже есть курс: уроки по темам, словарь, азбука, диалоги и тесты. Он не заменяет занятия с преподавателем. 3D-аватар пока прототип, поэтому для точной формы жеста сверяйтесь с видео носителей.",
                    "Both languages already have a course: topic lessons, dictionary, alphabet, dialogues and quizzes. It does not replace a teacher. The 3D avatar is still a prototype, so check exact hand shapes against the native-signer videos.",
                    "Екі тілге де курс бар: тақырыптық сабақтар, сөздік, әліпби, диалогтар және тесттер. Ол оқытушыны алмастырмайды. 3D аватар әзірге прототип, сондықтан ымның нақты пішінін ым иелерінің бейнелерімен салыстырыңыз.",
                  ),
                ],
                [
                  at(
                    "Где здесь AI-компонент?",
                    "Where is the AI component?",
                    "AI компоненті қайда?",
                  ),
                  at(
                    "Камера проверяет, как вы показываете жест. ИИ работает прямо в браузере, без API-ключей, видео никуда не отправляется. РЖЯ: 33 буквы и 1000 слов; на людях, которых ИИ не видел, слово узнаётся с первой попытки в 62,6% случаев. ҚЖЯ: 42 буквы, 736 слов и 12 бытовых фраз; в уроке ИИ находит нужное слово в 60% случаев, в диалоге реплику — в 57%. Связную речь и грамматику модель пока не распознаёт.",
                    "The camera checks how you sign. The AI runs in your browser without API keys and video never leaves your device. RSL: 33 letters and 1,000 words; on people the AI has never seen, the word is right on the first guess 62.6% of the time. KSL: 42 letters, 736 words and 12 everyday phrases; in a lesson the AI finds the right word 60% of the time, in a dialogue the right reply 57%. Continuous signing and grammar are not recognized yet.",
                    "Камера ымды қалай көрсететініңізді тексереді. ЖИ браузерде API кілтінсіз жұмыс істейді, бейне ешқайда жіберілмейді. РЖЯ: 33 әріп және 1000 сөз; ЖИ көрмеген адамдарда сөз бірінші болжаммен 62,6% жағдайда танылады. ҚЖЯ: 42 әріп, 736 сөз және 12 күнделікті сөйлем; сабақта ЖИ дұрыс сөзді 60%, диалогта дұрыс жауапты 57% жағдайда табады. Байланысқан сөйлеу мен грамматика әлі танылмайды.",
                  ),
                ],
                [
                  at(
                    "Нужны ли API-ключи для просмотра жестов?",
                    "Do I need API keys to view signs?",
                    "Ымдарды көруге API кілті керек пе?",
                  ),
                  at(
                    "Нет. Подготовленная 3D-анимация проигрывается в браузере. Камера для её просмотра тоже не нужна.",
                    "No. The prepared 3D animation plays in the browser. You do not need a camera to watch it.",
                    "Жоқ. Дайын 3D анимация браузерде ойнатылады. Көру үшін камера да қажет емес.",
                  ),
                ],
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
            <img
              className="landing-final-hands"
              src="/images/landing-v2/blue-ribbon.webp"
              alt=""
              loading="lazy"
            />
            <span className="mentor-kicker">AI MENTOR</span>
            <h2>
              {t("Ваш следующий")}
              <br />
              <span>{t("момент понимания.")}</span>
            </h2>
            <p>
              {at(
                "Начните со знакомства — первая фраза на русском или казахском жестовом языке.",
                "Start with an introduction: your first phrase in Russian or Kazakh Sign Language.",
                "Танысудан бастаңыз — орыс немесе қазақ ым тіліндегі алғашқы сөйлем.",
              )}
            </p>
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
            <p>
              {at(
                "Язык жестов. Больше способов понимать друг друга.",
                "Sign language. More ways to understand each other.",
                "Ым тілі. Бір-бірімізді түсінудің жаңа жолдары.",
              )}
            </p>
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
            <span>
              {at(
                "Смотрите. Повторяйте. Понимайте.",
                "Watch. Practise. Understand.",
                "Қараңыз. Қайталаңыз. Түсініңіз.",
              )}
            </span>
          </div>
        </footer>
      </div>
    </ProductSurface>
  );
}
