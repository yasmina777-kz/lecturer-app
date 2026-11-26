import { PlacementPrompt } from "../components/PlacementPrompt";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Eye,
  GraduationCap,
  MessageCircle,
  Play,
  Type,
  Hash,
  Smile,
  Users,
  Video,
  ChevronDown,
} from "lucide-react";
import { at } from "../i18n/automation";
import { courseLevels } from "../sign/exercises";
import { useSignProgress } from "../sign/useProgress";
import { useActivityProgress } from "../sign/useActivities";
import { reviewItems } from "../sign/activities";
import { lessonIds } from "../sign/catalog";
import { useSignLang } from "../sign/signLanguage";
import { kslLevels } from "./KazakhLearn";
import "./sign-courses.css";
import { HeartHandshake, Info } from "lucide-react";


/** Static mentor portrait (same person as the home page hero). */
export function LearningMentorPreview() {
  return (
    <div className="learning-mentor-preview">
      <img
        className="learning-hero-artwork"
        src="/images/learning/hero.png"
        alt={at("Наставница AI Mentor", "AI Mentor mentor", "AI Mentor тәлімгері")}
      />
    </div>
  );
}

export function LearningHome() {
  const [sl] = useSignLang();
  const ksl = sl === "ksl";
  const levels = ksl ? kslLevels() : courseLevels();
  const { progress } = useSignProgress();
  const { attempts } = useActivityProgress();
  const reviewCount = reviewItems(attempts).size;
  const hasHistory = Object.keys(progress).length > 0 || attempts.length > 0;
  const nextLessonId = lessonIds.find((id) => !progress[id]);
  const nextLesson = nextLessonId
    ? `/learn/${nextLessonId}`
    : "/practice?exercise=a";
  return (
    <div className="sign-workspace learning-home">
      <Link className="courses-back" to="/learn">
        <ArrowLeft size={16} />
        {at("Все курсы", "All courses", "Барлық курстар")}
        <b>{ksl ? "ҚЖЯ" : "РЖЯ"}</b>
      </Link>
      <PlacementPrompt hasHistory={hasHistory} />
      <section className="learning-intro" aria-labelledby="learning-title">
        <div className="learning-intro-copy">
          <h1 id="learning-title">
            {sl === "ksl"
              ? at("Изучайте\nказахский жестовый\nязык", "Learn\nKazakh Sign\nLanguage", "Қазақ\nым тілін\nүйреніңіз")
              : at("Изучайте\nрусский жестовый\nязык", "Learn\nRussian Sign\nLanguage", "Орыс\nым тілін\nүйреніңіз")}
          </h1>
          <p>
            {at(
              "Пошаговые уроки, интерактивные упражнения и ваш учебный помощник",
              "Step-by-step lessons, interactive exercises and your learning companion",
              "Қадамдық сабақтар, интерактивті жаттығулар және оқу көмекшіңіз",
            )}
          </p>
          <div className="learning-intro-actions">
            <Link className="button primary" to="/course">
              {hasHistory
                ? at(
                    "Продолжить обучение",
                    "Continue learning",
                    "Оқуды жалғастыру",
                  )
                : at("Начать обучение", "Start learning", "Оқуды бастау")}
              <ArrowRight size={18} />
            </Link>
            <Link className="learning-demo-link" to="/learn/getting-started">
              <span>
                <Play size={16} fill="currentColor" />
              </span>
              {at(
                "Как это работает?",
                "How does it work?",
                "Бұл қалай жұмыс істейді?",
              )}
            </Link>
          </div>
        </div>
        <button
          className="learning-scroll-cue"
          onClick={() => document.getElementById("learning-path-title")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          {at("Ниже: ваш путь и все упражнения", "Below: your path and all exercises", "Төменде: жолыңыз бен жаттығулар")}
          <ChevronDown size={16} />
        </button>
        <div className="learning-intro-art">
          <img
            className="learning-hero-artwork"
            src="/images/learning/hero.png"
            alt=""
          />
        </div>
      </section>
      <section className="learning-path" aria-labelledby="learning-path-title">
        <div className="section-heading">
          <div>
            <p className="section-label">
              {at("Ваш путь", "Your path", "Оқу жолыңыз")}
            </p>
            <h2 id="learning-path-title">
              {at(
                "От букв до диалогов",
                "From letters to dialogues",
                "Әріптерден диалогтарға дейін",
              )}
            </h2>
          </div>
          <Link className="text-link" to={ksl ? "/course" : "/practice"}>
            {ksl ? at("Все уроки ҚЖЯ", "All Kazakh SL lessons", "Барлық ҚЫТ сабақтары") : at("Все упражнения", "All exercises", "Барлық жаттығулар")}
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="learning-levels">
          {levels.map((level, index) => (
            <Link
              className="learning-level"
              key={level.id}
              to={`/learn?stage=${level.id}`}
            >
              <span className="learning-level-number">{level.id}</span>
              <div className="learning-level-copy">
                <h3>{level.title}</h3>
                <p>{level.description}</p>
                <small>{level.count}</small>
              </div>
              <img
                className="learning-level-hand"
                src={`/images/learning/${["hands-alphabet", "hand-words", "hand-phrases"][index]}.png`}
                alt=""
              />
              <span className="learning-level-arrow">
                <ArrowRight size={18} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <div className="learning-next-grid">
        <section className="learning-practice-banner">
          <div>
            <h2>
              {at(
                "Практикуйтесь\nв удобном формате",
                "Practise\nyour way",
                "Өзіңізге ыңғайлы\nтәсілмен жаттығыңыз",
              )}
            </h2>
            <p>
              {at(
                "Аватар, ракурсы и замедление — чтобы разобраться в каждом движении.",
                "Avatar views and slow motion help you understand each movement.",
                "Аватар, ракурстар және баяулату әр қимылды түсінуге көмектеседі.",
              )}
            </p>
            <Link to={ksl ? "/kazakh?tab=trainer" : "/practice"} className="button secondary">
              {at("Перейти к практике", "Open practice", "Жаттығуға өту")}
              <ArrowRight size={17} />
            </Link>
          </div>
          <img
            className="learning-practice-art"
            src="/images/learning/practice-hands.png"
            alt=""
          />
        </section>
        <section
          className="learning-activities"
          aria-labelledby="learning-activities-title"
        >
          <h2 id="learning-activities-title">
            {at("Следующие этапы", "Next stages", "Келесі кезеңдер")}
          </h2>
          {ksl ? (
            <>
              <Link to="/course/kz/phrases">
                <MessageCircle size={21} />
                <div>
                  <strong>{at("Фразы на каждый день", "Everyday phrases", "Күнделікті сөйлемдер")}</strong>
                  <span>{at("14 фраз «Оян, Qazaqstan»: смотрите и проходите тест", "14 «Оян, Qazaqstan» phrases with a quiz", "«Оян, Qazaqstan» 14 сөйлемі: көріп, тест тапсырыңыз")}</span>
                </div>
                <ArrowUpRight size={18} />
              </Link>
              <Link to="/course/kz/dialogue/tanysu">
                <Users size={21} />
                <div>
                  <strong>{at("Диалоги на ҚЖЯ", "Kazakh SL dialogues", "ҚЫТ диалогтары")}</strong>
                  <span>{at("Знакомство, помощь, приветствия — камера проверяет реплику", "Meeting, asking for help, greetings — the camera checks your reply", "Танысу, көмек, амандасу — камера жауапты тексереді")}</span>
                </div>
                <ArrowUpRight size={18} />
              </Link>
              <Link to="/kazakh?tab=trainer">
                <Type size={21} />
                <div>
                  <strong>{at("Тренажёр азбуки", "Alphabet trainer", "Әліпби жаттықтырғышы")}</strong>
                  <span>{at("42 буквы с проверкой камерой", "42 letters with a camera check", "42 әріп, камерамен тексеру")}</span>
                </div>
                <ArrowUpRight size={18} />
              </Link>
              <Link to="/fingerspell">
                <Eye size={21} />
                <div>
                  <strong>{at("Чтение дактиля", "Reading fingerspelling", "Дактильді оқу")}</strong>
                  <span>{at("Казахские слова по буквам", "Kazakh words letter by letter", "Қазақ сөздері әріптермен")}</span>
                </div>
                <ArrowUpRight size={18} />
              </Link>
              <Link to="/kazakh?tab=why">
                <Info size={21} />
                <div>
                  <strong>{at("РЖЯ и ҚЖЯ: в чём разница", "RSL vs Kazakh SL", "ОЫТ пен ҚЫТ айырмасы")}</strong>
                  <span>{at("Общие и казахские буквы, аналоги платформы", "Shared and Kazakh letters, similar platforms", "Ортақ және қазақ әріптері, аналогтар")}</span>
                </div>
                <ArrowUpRight size={18} />
              </Link>
              <Link to="/culture">
                <Users size={21} />
                <div>
                  <strong>{at("Культура и этикет глухих", "Deaf culture and etiquette", "Естімейтіндер мәдениеті мен әдебі")}</strong>
                  <span>{at("С чего начинают любой курс жестового языка", "Where every sign language course starts", "Кез келген ым тілі курсы осыдан басталады")}</span>
                </div>
                <ArrowUpRight size={18} />
              </Link>
              <Link to="/record-signs?lang=ksl">
                <HeartHandshake size={21} />
                <div>
                  <strong>{at("Помочь обучить ИИ", "Help train the AI", "ЖИ-ді үйретуге көмектесу")}</strong>
                  <span>{at("Покажите 30 слов камере — только точки рук, без видео", "Sign 30 words — hand points only, no video", "30 сөзді көрсетіңіз — тек қол нүктелері")}</span>
                </div>
                <ArrowUpRight size={18} />
              </Link>
            </>
          ) : (
            <>
          <Link to="/grammar">
            <GraduationCap size={21} />
            <div>
              <strong>{at("Грамматика", "Grammar", "Грамматика")}</strong>
              <span>
                {at(
                  "Порядок слов, вопросы, отрицание",
                  "Word order, questions, negation",
                  "Сөз тәртібі, сұрақ, болымсыздық",
                )}
              </span>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <Link to="/dialogues">
            <MessageCircle size={21} />
            <div>
              <strong>{at("Диалоги", "Dialogues", "Диалогтар")}</strong>
              <span>
                {at(
                  "7 ситуаций: знакомство, кафе, семья, планы…",
                  "7 situations: meeting, café, family, plans…",
                  "7 жағдаят: танысу, кафе, отбасы, жоспар…",
                )}
              </span>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <Link to="/numbers">
            <Hash size={21} />
            <div>
              <strong>{at("Числа, время, деньги", "Числа, время, деньги", "Числа, время, деньги")}</strong>
              <span>{at("Цифры, часы и цены на видео носителей", "Цифры, часы и цены на видео носителей", "Цифры, часы и цены на видео носителей")}</span>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <Link to="/face-trainer">
            <Smile size={21} />
            <div>
              <strong>{at("Тренажёр мимики", "Тренажёр мимики", "Тренажёр мимики")}</strong>
              <span>{at("Вопрос, отрицание и кивок — ИИ проверит по камере", "Вопрос, отрицание и кивок — ИИ проверит по камере", "Вопрос, отрицание и кивок — ИИ проверит по камере")}</span>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <Link to="/kazakh">
            <Type size={21} />
            <div>
              <strong>{at("Казахский жестовый язык", "Kazakh Sign Language", "Қазақ ым тілі")}</strong>
              <span>{at("Дактиль 42 буквы с камерой, отличия от РЖЯ, аналоги", "42-letter fingerspelling with camera, RSL vs Kazakh, alternatives", "42 әріпті дактиль, камера, аналогтар")}</span>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <Link to="/culture">
            <Users size={21} />
            <div>
              <strong>{at("Культура и этикет глухих", "Культура и этикет глухих", "Культура и этикет глухих")}</strong>
              <span>{at("С чего начинают любой курс жестового языка", "Where every sign language course starts", "Кез келген ым тілі курсы осыдан басталады")}</span>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <Link to="/live-practice">
            <Video size={21} />
            <div>
              <strong>{at("Самопроверка и практика", "Самопроверка и практика", "Самопроверка и практика")}</strong>
              <span>{at("Вы рядом с носителем + где найти живую практику", "Вы рядом с носителем + где найти живую практику", "Вы рядом с носителем + где найти живую практику")}</span>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <Link to="/fingerspell">
            <Type size={21} />
            <div>
              <strong>{at("Чтение дактиля", "Reading fingerspelling", "Дактильді оқу")}</strong>
              <span>
                {at(
                  "Имена и слова по буквам — как в жизни",
                  "Names and words spelled letter by letter",
                  "Есімдер мен сөздер әріптермен",
                )}
              </span>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <Link to="/understanding">
            <Eye size={21} />
            <div>
              <strong>
                {at("Понимание жестов", "Understand signs", "Ымдарды түсіну")}
              </strong>
              <span>
                {at(
                  "Смотрите видео и выбирайте значение",
                  "Watch a video and choose its meaning",
                  "Бейнені көріп, мағынасын таңдаңыз",
                )}
              </span>
            </div>
            <ArrowUpRight size={18} />
          </Link>
            </>
          )}
        </section>
      </div>
      <section
        className="learning-resources"
        aria-label={at(
          "Полезные материалы",
          "Useful resources",
          "Пайдалы материалдар",
        )}
      >
        <Link to={ksl ? "/vocab" : "/text-to-sign?tab=dictionary"}>
          <Type size={21} />
          <div>
            <h3>{at("Открыть словарь", "Open dictionary", "Сөздікті ашу")}</h3>
            <p>
              {ksl
                ? at("751 жест SURDO.KZ и 42 буквы", "751 SURDO.KZ signs and 42 letters", "SURDO.KZ 751 ымы және 42 әріп")
                : at(
                    "Слова, выражения и все 33 буквы",
                    "Words, expressions and all 33 letters",
                    "Сөздер, тіркестер және 33 әріп",
                  )}
            </p>
          </div>
          <ArrowRight size={18} />
        </Link>
        <Link to={ksl ? "/kazakh?tab=why" : "/learn/alphabet-intro"}>
          <BookOpen size={21} />
          <div>
            <h3>
              {at(
                "Для чего нужен дактиль?",
                "What is fingerspelling for?",
                "Дактиль не үшін қажет?",
              )}
            </h3>
            <p>
              {at(
                "Короткая справка — читать необязательно",
                "An optional short introduction",
                "Міндетті емес қысқа анықтама",
              )}
            </p>
          </div>
          <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  );
}
