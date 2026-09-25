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
  Volume2,
} from "lucide-react";
import { AvatarPlayer } from "../components/AvatarPlayer";
import { Brand } from "../components/UI";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n";
export default function LandingPage() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [motionPaused, setMotionPaused] = useState(false);
  const [audience, setAudience] = useState<"student" | "teacher">("student");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.08 },
    );
    root.current
      ?.querySelectorAll("[data-reveal]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  const destination = user ? "/dashboard" : "/register";
  const steps = [
    t("Загрузите материал"),
    t("Послушайте лекцию"),
    t("Задайте вопрос"),
    t("Закрепите знания"),
  ];
  return (
    <div className={`mentor-site${motionPaused ? " motion-paused" : ""}`} ref={root}>
      <div className="mentor-reading-progress" aria-hidden="true" />
      <header className="mentor-header">
        <Link to="/" aria-label="AI Mentor">
          <Brand />
        </Link>
        <nav aria-label={t("Навигация по сайту")}>
          <a href="#possibilities">{t("Возможности")}</a>
          <a href="#experience">{t("Как это работает")}</a>
          <a href="#for-you">{t("Для кого")}</a>
        </nav>
        <div className="mentor-header-actions">
          <LanguageSwitcher />
          <Link className="mentor-signin" to={user ? "/dashboard" : "/login"}>
            {user ? t("В кабинет") : t("Войти")}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <main>
        <section className="mentor-hero">
          <div className="hero-grid-lines" aria-hidden="true" />
          <div className="mentor-ambient" aria-hidden="true"><i /><i /><i /></div>
          <div className="mentor-hero-copy">
            <span className="mentor-kicker">
              <span /> {t("Ваш AI-преподаватель")}
            </span>
            <h1>
              {t("Знания.")}
              <br />
              <span>{t("В диалоге.")}</span>
            </h1>
            <p>
              {t(
                "Превратите учебный материал в занятие, где можно слушать, спрашивать и понимать. AI Mentor объясняет тему в вашем темпе — от первого слайда до самостоятельной практики.",
              )}
            </p>
            <div className="mentor-hero-actions">
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
              {t("Один вопрос — больше понимания")}
            </div>
          </div>
          <div
            className="mentor-hero-art"
            aria-label={t("Векторный AI-преподаватель")}
          >
            <div className="mentor-knowledge-orbit" aria-hidden="true">
              <span><BookOpen size={22} /></span>
              <span><Sparkles size={20} /></span>
              <span><GraduationCap size={23} /></span>
            </div>
            <div className="mentor-orbit orbit-a" />
            <div className="mentor-orbit orbit-b" />
            <div className="mentor-art-type" aria-hidden="true">
              AI
            </div>
            <div className="mentor-portrait">
              <AvatarPlayer
                avatarId="classic-female"
                style="violet"
                state="speaking"
              />
            </div>
            <div className="mentor-float question-float">
              <Mic size={18} />
              <span>{t("А можно на примере?")}</span>
            </div>
            <div className="mentor-float voice-float">
              <div className="mentor-wave" aria-hidden="true">
                {Array.from({ length: 15 }, (_, i) => (
                  <i key={i} style={{ animationDelay: `${i * 0.08}s` }} />
                ))}
              </div>
              <span>{t("Конечно. Давайте разберёмся.")}</span>
            </div>
            <div className="mentor-art-index" aria-hidden="true">
              01 — AI MENTOR
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
          <span>{t("Ваш материал. Новый способ учиться.")}</span>
          <div>
            <FileText size={15} />
            PDF
            <i />
            DOCX
            <i />
            PPTX
            <i />
            TXT
            <i />
            {t("Или просто тема")}
          </div>
        </div>
        <section id="possibilities" className="mentor-section" data-reveal>
          <div className="mentor-section-heading">
            <span className="mentor-kicker">01 / {t("Возможности")}</span>
            <h2>
              {t("От сложного текста")}
              <br />
              <span>{t("к понятной картине.")}</span>
            </h2>
            <p>
              {t(
                "Презентация, голос преподавателя и практика связаны в одно занятие. Всё, что нужно для работы с темой, остаётся рядом.",
              )}
            </p>
          </div>
          <div className="mentor-features">
            <article className="mentor-feature feature-large" data-reveal>
              <div className="mini-slide">
                <div className="mini-slide-top">
                  <span>AI MENTOR</span>
                  <Layers size={17} />
                </div>
                <span className="mini-slide-count">01 / 05</span>
                <h3>{t("Как работает память")}</h3>
                <div className="memory-diagram">
                  <span>{t("Изучить")}</span>
                  <ArrowRight />
                  <span>{t("Вспомнить")}</span>
                  <ArrowRight />
                  <span>{t("Проверить")}</span>
                </div>
                <div className="mini-slide-bottom">
                  <Volume2 size={17} />
                  <div className="mini-track">
                    <i />
                  </div>
                  <Pause size={15} />
                </div>
              </div>
              <div className="feature-copy">
                <Layers size={22} />
                <h3>{t("Материал становится лекцией")}</h3>
                <p>
                  {t(
                    "Загрузите документ или опишите тему. AI подготовит структуру, слайды и связное объяснение с примерами. Выберите язык, уровень сложности и объём занятия.",
                  )}
                </p>
              </div>
            </article>
            <article className="mentor-feature feature-dialogue" data-reveal>
              <div className="mini-conversation">
                <div>
                  <Mic size={15} />
                  {t("Почему это работает?")}
                </div>
                <p>
                  <Sparkles size={17} />
                  {t("Давайте свяжем эту идею с тем, что вы уже знаете.")}
                </p>
              </div>
              <div className="feature-copy">
                <AudioLines size={22} />
                <h3>{t("Вопрос не прерывает обучение")}</h3>
                <p>
                  {t(
                    "Спросите голосом или напишите. Презентация остановится, аватар объяснит непонятный момент, а затем лекция продолжится с того же места.",
                  )}
                </p>
              </div>
            </article>
            <article className="mentor-feature feature-practice" data-reveal>
              <div className="mini-checklist">
                <span>
                  <CheckCheck size={19} />
                  {t("Главное — своими словами")}
                </span>
                <span>
                  <Check size={17} />
                  {t("Конспект готов")}
                </span>
                <span>
                  <Check size={17} />
                  {t("Есть вопросы для самопроверки")}
                </span>
                <span>
                  <Plus size={17} />
                  {t("Осталось применить на практике")}
                </span>
              </div>
              <div className="feature-copy">
                <GraduationCap size={22} />
                <h3>{t("Понимание остаётся с вами")}</h3>
                <p>
                  {t(
                    "Сохраните заметки, скачайте конспект, пройдите тест и выполните короткие задания. Результаты сохраняются, чтобы вы могли вернуться к теме.",
                  )}
                </p>
              </div>
            </article>
          </div>
        </section>
        <section className="mentor-visual-story mentor-section" aria-labelledby="visual-story-title">
          <div className="mentor-section-heading" data-reveal>
            <span className="mentor-kicker">AI MENTOR / {t("Искусство учиться")}</span>
            <h2 id="visual-story-title">{t("Смотрите шире.")}<br /><span>{t("Понимайте глубже.")}</span></h2>
          </div>
          <div className="mentor-artworks">
            <article className="mentor-artwork" data-reveal>
              <div className="mentor-artwork-image">
                <img src="/images/knowledge-book.png" width="1536" height="1024" loading="lazy" decoding="async"
                  alt={t("Открытая книга с парящими страницами и стеклянными схемами")} />
                <span className="mentor-artwork-number" aria-hidden="true">01 / EXPLORE</span>
              </div>
              <div className="mentor-artwork-caption">
                <BookOpen size={23} aria-hidden="true" />
                <div><h3>{t("У знаний нет границ.")}</h3><p>{t("От одной страницы — к целой картине. Исследуйте тему через объяснения, примеры и вопросы.")}</p></div>
                <a href="#possibilities" aria-label={t("Возможности")}><ArrowUpRight size={22} /></a>
              </div>
            </article>
            <article className="mentor-artwork" data-reveal>
              <div className="mentor-artwork-image">
                <img src="/images/dialogue-sculpture.png" width="1536" height="1024" loading="lazy" decoding="async"
                  alt={t("Стальные петли вокруг светящейся сферы и ступени к ней")} />
                <span className="mentor-artwork-number" aria-hidden="true">02 / CONNECT</span>
              </div>
              <div className="mentor-artwork-caption">
                <AudioLines size={23} aria-hidden="true" />
                <div><h3>{t("Понимание рождается в диалоге.")}</h3><p>{t("Связывайте новые идеи с тем, что уже знаете. Один хороший вопрос помогает сделать следующий шаг.")}</p></div>
                <a href="#experience" aria-label={t("Как это работает")}><ArrowUpRight size={22} /></a>
              </div>
            </article>
          </div>
        </section>
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
              <span>{t("Живой диалог.")}</span>
            </h2>
            <p>
              {t(
                "Попробуйте переключить этапы. Так выглядит путь от вашего материала до закреплённых знаний.",
              )}
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
                          t(
                            "Документ или тема — вы выбираете отправную точку.",
                          ),
                          t(
                            "Аватар знакомит с темой. Затем остаются слайды и голос.",
                          ),
                          t(
                            "Остановитесь на сложном месте и получите объяснение.",
                          ),
                          t("Проверьте себя и сохраните то, что важно."),
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
                      <span>lecture.pdf</span>
                      <Check size={18} />
                    </div>
                    <h3>{t("С чего начнём?")}</h3>
                    <p>
                      {t(
                        "Выберите материал или расскажите, что хотите изучить. Остальное подготовит AI Mentor.",
                      )}
                    </p>
                    <div className="preview-tags">
                      <span>PDF</span>
                      <span>DOCX</span>
                      <span>PPTX</span>
                      <span>TXT</span>
                    </div>
                  </>
                ) : step === 1 ? (
                  <>
                    <div className="preview-avatar">
                      <AvatarPlayer compact style="violet" state="speaking" />
                    </div>
                    <h3>{t("Здравствуйте! Начнём с главного.")}</h3>
                    <p>
                      {t(
                        "Понятные слайды. Связный рассказ. Скорость, которую выбираете вы.",
                      )}
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
                      {t("Объясни это проще")}
                    </div>
                    <p>
                      {t(
                        "AI отвечает с учётом текущей лекции и слайда. После объяснения можно продолжить.",
                      )}
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
                      {t(
                        "Краткий конспект, тест и практические задания уже рядом. Ваши ответы и заметки сохраняются в аккаунте.",
                      )}
                    </p>
                    <div className="preview-tags">
                      <span>{t("Конспект")}</span>
                      <span>{t("Тест")}</span>
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
                  ? t("Учитесь без страха переспросить.")
                  : t("Ваши знания. Ваш AI-преподаватель.")}
              </h3>
              <p>
                {audience === "student"
                  ? t(
                      "Разбирайте новый материал в удобном темпе. Возвращайтесь к сложным фрагментам, задавайте вопросы и проверяйте, что действительно запомнилось.",
                    )
                  : t(
                      "После назначения роли администратором выберите в настройках персонажа, голос и язык. Создавайте подробные лекции с иллюстрациями и публикуйте их для студентов.",
                    )}
              </p>
              <ul>
                {(audience === "student"
                  ? [
                      t("Голосовые и текстовые вопросы по ходу лекции"),
                      t("Конспект и личные заметки в одном месте"),
                      t("Тесты, задания и сохранённый прогресс"),
                    ]
                  : [
                      t("Мужской и женский векторные аватары"),
                      t("Свой язык и голос для новых лекций"),
                      t("Публикация собственных учебных материалов"),
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
                avatarId={
                  audience === "teacher" ? "classic-female" : "classic-male"
                }
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
        <section className="mentor-language-section" data-reveal>
          <div>
            <span className="mentor-kicker">RU / EN / KZ</span>
            <h2>{t("Ближе на вашем языке.")}</h2>
            <p>
              {t(
                "Интерфейс и занятия доступны на русском, английском и казахском. Язык меню и язык лекции выбираются отдельно — учитесь так, как вам удобно.",
              )}
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
              [
                t("Как начать пользоваться AI Mentor?"),
                t(
                  "Создайте аккаунт студента. После входа можно открыть готовую лекцию или создать новую. Роль преподавателя для публикации занятий назначает администратор.",
                ),
              ],
              [
                t("Какие материалы можно загрузить?"),
                t(
                  "PDF с текстовым слоем, DOCX, PPTX, TXT и MD размером до 10 МБ. Из документов извлекается текст. Для сканированных страниц сначала понадобится распознавание текста.",
                ),
              ],
              [
                t("Можно ли задавать вопросы во время лекции?"),
                t(
                  "Да. На слайде нажмите «Задать вопрос» и напишите его или включите микрофон. Лекция остановится на время ответа. Затем можно вернуться к текущему предложению.",
                ),
              ],
              [
                t("Откуда берётся голос преподавателя?"),
                t(
                  "Озвучка использует доступные голоса устройства или подключённый облачный сервис. Доступность выбранного языка и тембра зависит от настройки озвучки. Текст объяснения всегда можно прочитать.",
                ),
              ],
              [
                t("Что доступно без подключения AI?"),
                t(
                  "Регистрация, выбор аватара, демонстрационные лекции на трёх языках, конспекты, заметки и практика. Создание новых лекций и ответы AI требуют подключения провайдера владельцем платформы.",
                ),
              ],
              [
                t("Кто видит мои лекции и заметки?"),
                t(
                  "Личные лекции доступны автору и администратору. Преподаватель может опубликовать свои лекции для зарегистрированных пользователей. Заметки и результаты относятся к вашему аккаунту. При генерации текст материала отправляется AI-провайдеру.",
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
          <div className="mentor-final-orbit" aria-hidden="true" />
          <span className="mentor-kicker">AI MENTOR</span>
          <h2>
            {t("Ваш следующий")}
            <br />
            <span>{t("момент понимания.")}</span>
          </h2>
          <p>{t("Начните с темы, которая вам интересна.")}</p>
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
          <p>{t("Обучение, в котором есть место вашему вопросу.")}</p>
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
          <span>{t("Учитесь. Спрашивайте. Понимайте.")}</span>
        </div>
      </footer>
    </div>
  );
}
