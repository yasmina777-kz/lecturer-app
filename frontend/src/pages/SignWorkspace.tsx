import { lazyPage } from "../lazyPage";
import { Suspense, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Hand,
  Play,
  Type,
  ScanLine,
  MessageCircle,
  Eye,
  Layers,
} from "lucide-react";
import { useSignLang } from "../sign/signLanguage";
import { at } from "../i18n/automation";
import { Empty, ErrorMessage, Loading } from "../components/UI";
import { lessonIds, lessons, reading } from "../sign/catalog";
import { useSignProgress } from "../sign/useProgress";

import "./sign-workspace.css";
import { SignDictionaryPage } from "./SignDictionary";
import { SignCourseCatalog, SignTrainingRoom } from "./SignTrainer";
import { LearningMentorPreview } from "./LearningHome";
import { SHOW_HUMAN_VIDEOS } from "../components/SignSequencePlayer";
import { PhraseVideos } from "../components/HumanSequencePlayer";
import "./lesson-simple.css";
const GesturePreview = lazyPage(() =>
  import("./GesturePreviewPage").then((m) => ({
    default: m.GesturePreviewPage,
  })),
);
const storageNote = () =>
  at(
    "Отметки сохраняются только в этом браузере для вашего аккаунта. Это история занятий, а не оценка владения РЖЯ.",
    "Marks are saved only in this browser for your account. This is a learning history, not an assessment of RSL proficiency.",
    "Белгілер осы браузерде аккаунтыңыз үшін ғана сақталады. Бұл — оқу тарихы, орыс ым тілін меңгеру бағасы емес.",
  );
function Heading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">
          {at("РУССКИЙ ЖЕСТОВЫЙ ЯЗЫК", "RUSSIAN SIGN LANGUAGE", "ОРЫС ЫМ ТІЛІ")}
        </span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
export function SignLearningPage() {
  return <SignCourseCatalog />;
}
export function SignLessonPage() {
  const { id } = useParams();
  return <LessonContent key={id} id={id} />;
}
function LessonContent({ id }: { id?: string }) {
  const lesson = lessons().find((l) => l.id === id);
  const { progress, error, save } = useSignProgress();
  const [answer, setAnswer] = useState<number | null>(null);
  const [repeated, setRepeated] = useState(false);
  if (!lesson)
    return (
      <Empty
        title={at("Такого урока нет", "Lesson not found", "Сабақ табылмады")}
        text={at(
          "Выберите карточку в разделе обучения.",
          "Choose a card in Learning.",
          "Оқу бөлімінен карточканы таңдаңыз.",
        )}
        action={
          <Link to="/learn" className="button primary">
            {at("К урокам", "Lessons", "Сабақтарға")}
          </Link>
        }
      />
    );
  const content = reading(lesson.id);
  const nextLessonId = lessonIds[lessonIds.indexOf(lesson.id) + 1];
  const prototype = lesson.kind === "prototype";
  return (
    <div className="sign-workspace lesson-page">
      <Link to={`/learn?stage=${lesson.level}`} className="sign-back">
        <ArrowLeft size={16} />
        {at(
          "Все этапы и уроки",
          "All stages and lessons",
          "Барлық кезеңдер мен сабақтар",
        )}
      </Link>
      <Heading
        title={lesson.title}
        description={
          prototype
            ? at(
                "Пробный показ. Анимация ещё требует проверки носителем РЖЯ. Сверяйтесь с видеообразцом человека.",
                "Prototype demonstration. The animation still needs review by an RSL signer. Compare it with the human reference video.",
                "Сынақ көрсетілімі. Анимацияны орыс ым тілінің маманы тексеруі керек. Адамның бейнеүлгісімен салыстырыңыз.",
              )
            : lesson.description
        }
      />
      {prototype ? (
        SHOW_HUMAN_VIDEOS ? (
          <div className="panel">
            <PhraseVideos labels={["ты", "имя", "кто?"]} />
          </div>
        ) : (
          <Suspense fallback={<Loading />}>
            <GesturePreview embedded />
          </Suspense>
        )
      ) : (
        <div className="lesson-simple">
          <ol className="lesson-steps">
            {content.blocks.map(([title, text], i) => {
              const [first, ...rest] = text.split(/(?<=[.!?])\s+/);
              return (
                <li key={title} className="lesson-step">
                  <span className="lesson-step-number">{i + 1}</span>
                  <div>
                    <h2>{title}</h2>
                    <p>{first}</p>
                    {rest.length > 0 && (
                      <details>
                        <summary>{at("Подробнее", "More", "Толығырақ")}</summary>
                        <p>{rest.join(" ")}</p>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="lesson-avatar">
            <LearningMentorPreview />
          </div>
        </div>
      )}
      {lesson.activity && (
        <div className="sign-lesson-activity">
          <Link className="button primary" to={lesson.activity}>
            {at("Перейти к практике", "Go to practice", "Жаттығуға өту")}
            <ArrowRight size={17} />
          </Link>
        </div>
      )}
      <section className="panel sign-check">
        <span className="eyebrow">
          {prototype
            ? at(
                "САМОСТОЯТЕЛЬНОЕ ПОВТОРЕНИЕ",
                "INDEPENDENT PRACTICE",
                "ӨЗ БЕТІМЕН ҚАЙТАЛАУ",
              )
            : at("КОРОТКАЯ ПРОВЕРКА", "QUICK CHECK", "ҚЫСҚА ТЕКСЕРУ")}
        </span>
        <h2>
          {prototype
            ? at("Попробуйте повторить", "Try it yourself", "Өзіңіз қайталаңыз")
            : content.question}
        </h2>
        {prototype ? (
          <>
            <p>
              {at(
                "Посмотрите видео, замедлите его и повторите сами.",
                "Watch the reference, inspect the avatar step by step and practise. AI checking is available for isolated letters in practice; compare phrases with the reference.",
                "Бейнеүлгіні көріп, аватарды қадам бойынша қарап, қайталаңыз. ЖИ жеке әріптерді тексереді; сөйлемдерді үлгімен салыстырыңыз.",
              )}
            </p>
            <label className="sign-check-row">
              <input
                type="checkbox"
                checked={repeated}
                onChange={(e) => setRepeated(e.target.checked)}
              />
              {at(
                "Я посмотрел(а) образец и попробовал(а) повторить",
                "I watched the reference and tried practising",
                "Үлгіні көріп, қайталап көрдім",
              )}
            </label>
          </>
        ) : (
          <fieldset className="sign-answers">
            <legend className="sr-only">{content.question}</legend>
            {content.options.map((option, i) => (
              <label key={i} className={answer === i ? "selected" : ""}>
                <input
                  type="radio"
                  name={`quiz-${lesson.id}`}
                  checked={answer === i}
                  onChange={() => setAnswer(i)}
                />
                {option}
              </label>
            ))}
            <p aria-live="polite">
              {answer !== null
                ? answer === content.correct
                  ? content.explanation
                  : at(
                      "Попробуйте ещё раз: ответ есть в тексте урока.",
                      "Try again: the answer is in the lesson text.",
                      "Қайта көріңіз: жауап сабақ мәтінінде бар.",
                    )
                : at(
                    "Выберите один ответ.",
                    "Choose one answer.",
                    "Бір жауапты таңдаңыз.",
                  )}
            </p>
          </fieldset>
        )}
        <button
          className="button primary"
          disabled={prototype ? !repeated : answer !== content.correct}
          onClick={() => save(lesson.id)}
        >
          <Check size={17} />
          {prototype
            ? at("Отметить повторение", "Mark practice", "Қайталауды белгілеу")
            : at(
                "Завершить вводный урок",
                "Complete introduction",
                "Кіріспені аяқтау",
              )}
        </button>
        <ErrorMessage message={error} />
        {progress[lesson.id] && (
          <p className="sign-done" role="status">
            <Check size={16} />
            {at("Отметка сохранена.", "Mark saved.", "Белгі сақталды.")}{" "}
            <Link to="/practice">
              {at("Моя практика →", "My practice →", "Менің жаттығуым →")}
            </Link>
          </p>
        )}
        <p className="sign-save-note">{storageNote()}</p>
      </section>
      <Link
        className="sign-back"
        to={
          nextLessonId
            ? `/learn/${nextLessonId}`
            : `/learn?stage=${lesson.level}`
        }
      >
        {at("Дальше", "Next", "Келесі")}
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
export function SignTextPage() {
  return <SignDictionaryPage />;
}
export function SignPracticePage() {
  return (
    <div className="sign-workspace practice-page">
      <SignTrainingRoom />
    </div>
  );
}
/** «Что где находится»: one picture card per section, different for РЖЯ and ҚЖЯ. */
export function SignHelpPage() {
  const [sl] = useSignLang();
  const ksl = sl === "ksl";
  const cards: { to: string; icon: typeof BookOpen; image: string; title: string; text: string; tag: string }[] = ksl
    ? [
        { to: "/learn", icon: BookOpen, image: "study-desk", title: at("Обучение", "Learning", "Оқу"), text: at("Казахская азбука, слова SURDO.KZ, фразы и диалоги — по шагам.", "Kazakh alphabet, SURDO.KZ words, phrases and dialogues — step by step.", "Қазақ әліпбиі, SURDO.KZ сөздері, сөйлемдер мен диалогтар — қадаммен."), tag: at("3 уровня", "3 levels", "3 деңгей") },
        { to: "/vocab", icon: Layers, image: "/images/rsl-units/10.webp", title: at("Тренажёр слов", "Word trainer", "Сөз жаттықтырғышы"), text: at("Выберите тему и смотрите жесты носителя по одному.", "Pick a topic and watch the signer word by word.", "Тақырып таңдап, ымдарды бір-бірлеп қараңыз."), tag: at("751 жест", "751 signs", "751 ым") },
        { to: "/text-to-sign", icon: Type, image: "hands-detail", title: at("Текст → жесты", "Text → signs", "Мәтін → ым"), text: at("Напишите по-казахски или по-русски — покажем жесты по порядку.", "Type in Kazakh or Russian — signs play in order.", "Қазақша не орысша жазыңыз — ымдар ретімен көрсетіледі."), tag: at("+ 14 фраз", "+ 14 phrases", "+ 14 сөйлем") },
        { to: "/course/kz/phrases", icon: MessageCircle, image: "/images/rsl-units/28.webp", title: at("Фразы на каждый день", "Everyday phrases", "Күнделікті сөйлемдер"), text: at("«Сәлеметсіз бе!», «Рахмет!» — показывают глухие жители Астаны.", "«Сәлеметсіз бе!», «Рахмет!» — shown by deaf people of Astana.", "«Сәлеметсіз бе!», «Рахмет!» — Астананың естімейтін тұрғындары көрсетеді."), tag: at("14 фраз", "14 phrases", "14 сөйлем") },
        { to: "/course/kz/dialogue/tanysu", icon: MessageCircle, image: "conversation", title: at("Диалоги", "Dialogues", "Диалогтар"), text: at("Знакомство, помощь, приветствия. Камера проверяет вашу реплику.", "Meeting, asking for help, greetings. The camera checks your reply.", "Танысу, көмек, амандасу. Камера жауабыңызды тексереді."), tag: at("3 диалога", "3 dialogues", "3 диалог") },
        { to: "/kazakh?tab=trainer", icon: Hand, image: "/images/courses/ksl.webp", title: at("Тренажёр азбуки", "Alphabet trainer", "Әліпби жаттықтырғышы"), text: at("Покажите букву — камера скажет, верно ли.", "Show a letter — the camera says if it is right.", "Әріпті көрсетіңіз — камера дұрыс па, айтады."), tag: at("42 буквы", "42 letters", "42 әріп") },
      ]
    : [
        { to: "/learn", icon: BookOpen, image: "study-desk", title: at("Обучение", "Learning", "Оқу"), text: at("Азбука, первые слова и темы курса — по шагам.", "Alphabet, first words and course topics — step by step.", "Әліпби, алғашқы сөздер және курс тақырыптары — қадаммен."), tag: at("3 уровня", "3 levels", "3 деңгей") },
        { to: "/vocab", icon: Layers, image: "/images/rsl-units/10.webp", title: at("Тренажёр слов", "Word trainer", "Сөз жаттықтырғышы"), text: at("Слова по темам на видео носителей и повторение ошибок.", "Topic words on signer videos, with review of mistakes.", "Тақырыптық сөздер және қателерді қайталау."), tag: at("900+ слов", "900+ words", "900+ сөз") },
        { to: "/text-to-sign", icon: Type, image: "hands-detail", title: at("Текст → жесты", "Text → signs", "Мәтін → ым"), text: at("Напишите или скажите фразу — жесты покажут по порядку.", "Type or say a phrase — signs play in order.", "Сөйлемді жазыңыз не айтыңыз — ымдар ретімен көрсетіледі."), tag: at("+ 32 фразы", "+ 32 phrases", "+ 32 сөйлем") },
        { to: "/practice", icon: Hand, image: "practice", title: at("Азбука с камерой", "Alphabet with camera", "Камерамен әліпби"), text: at("Покажите букву — ИИ проверит её через камеру.", "Show a letter — the AI checks it through the camera.", "Әріпті көрсетіңіз — ЖИ камера арқылы тексереді."), tag: at("33 буквы", "33 letters", "33 әріп") },
        { to: "/dialogues", icon: MessageCircle, image: "conversation", title: at("Диалоги", "Dialogues", "Диалогтар"), text: at("Знакомство, кафе, семья: выбирайте ответы и продолжайте разговор.", "Meeting, café, family: choose replies and keep talking.", "Танысу, кафе, отбасы: жауап таңдап, әңгімені жалғастырыңыз."), tag: at("7 ситуаций", "7 situations", "7 жағдаят") },
        { to: "/understanding", icon: Eye, image: "/images/rsl-units/37.webp", title: at("Понимание жестов", "Understand signs", "Ымдарды түсіну"), text: at("Смотрите жест без подписи и выбирайте смысл. Камера не нужна.", "Watch an unlabelled sign and choose its meaning. No camera.", "Жазусыз ымды көріп, мағынасын таңдаңыз."), tag: at("171 видео", "171 videos", "171 бейне") },
      ];
  return (
    <div className="sign-workspace help-overview help-v2">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {ksl ? at("КАЗАХСКИЙ ЖЕСТОВЫЙ ЯЗЫК", "KAZAKH SIGN LANGUAGE", "ҚАЗАҚ ЫМ ТІЛІ") : at("РУССКИЙ ЖЕСТОВЫЙ ЯЗЫК", "RUSSIAN SIGN LANGUAGE", "ОРЫС ЫМ ТІЛІ")}
          </span>
          <h1>{at("Что где находится", "Where to find everything", "Қай бөлімде не бар")}</h1>
          <p>
            {at(
              "Шесть разделов платформы. Выберите, что хотите сделать: учиться, переводить или проверять себя камерой.",
              "Six sections. Choose what you want to do: learn, translate or check yourself with the camera.",
              "Платформаның алты бөлімі. Не істегіңіз келетінін таңдаңыз: үйрену, аудару немесе камерамен тексеру.",
            )}
          </p>
        </div>
        <img className="help-hero-art" src="/images/landing-v2/mentor-pointing.webp" alt="" />
      </div>
      <div className="help-cards">
        {cards.map(({ to, icon: Icon, image, title, text, tag }) => (
          <Link className="help-card card-motion" to={to} key={to}>
            <span className="help-card-media">
              <img src={image.startsWith("/") ? image : `/images/landing-v2/${image}.webp`} alt="" loading="lazy" />
              <span className="help-card-tag">{tag}</span>
            </span>
            <span className="help-card-body">
              <span className="help-card-icon" aria-hidden="true"><Icon size={20} /></span>
              <strong>{title}</strong>
              <span>{text}</span>
              <span className="help-card-cta">
                {at("Открыть", "Open", "Ашу")} <ArrowUpRight size={16} />
              </span>
            </span>
          </Link>
        ))}
      </div>
      <p className="help-note">
        {at(
          "Распознавание жестов работает прямо в браузере: видео с камеры никуда не отправляется. ИИ иногда ошибается — сверяйтесь с видео носителей.",
          "Sign recognition runs in your browser: camera video never leaves your device. The AI can be wrong — compare with the signer videos.",
          "Ымды тану браузерде жұмыс істейді: камера бейнесі ешқайда жіберілмейді. ЖИ қателесуі мүмкін — ым иелерінің бейнелерімен салыстырыңыз.",
        )}
      </p>
    </div>
  );
}
