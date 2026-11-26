import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Camera, Check, Play } from "lucide-react";
import { at } from "../i18n/automation";
import { LetterTile, StageTabs } from "../components/LetterTile";
import { KSL_KAZAKH_ONLY, KSL_LETTERS, SURDO_LETTER } from "../sign/kslLetters";
import { kslLessons, readProgress, topicName, useKslCatalog } from "./KazakhCourse";
import { KazakhTeacherSection } from "./KazakhTeacher";
import "./sign-workspace.css";
import "./course.css";

/** The three levels of the Kazakh SL course (/learn in ҚЖЯ mode). The РЖЯ
 * levels live in sign/exercises.ts; the two never mix. */
export function kslLevels() {
  return [
    {
      id: 1,
      title: at("Казахская азбука", "Kazakh alphabet", "Қазақ әліпбиі"),
      description: at(
        "42 буквы: 33 общие с русским дактилем и 9 казахских. Каждую показывает носитель ҚЖЯ, а камера проверяет ваш показ.",
        "42 letters: 33 shared with Russian fingerspelling and 9 Kazakh ones. Each is shown by a Kazakh signer; the camera checks you.",
        "42 әріп: 33-і орыс дактилімен ортақ, 9-ы қазақ әріптері. Әрқайсысын ҚЫТ иесі көрсетеді, камера сізді тексереді.",
      ),
      count: at("42 буквы · видео носителя · камера", "42 letters · signer video · camera", "42 әріп · ым иесінің бейнесі · камера"),
    },
    {
      id: 2,
      title: at("Первые слова", "First words", "Алғашқы сөздер"),
      description: at(
        "Слова по темам из словаря SURDO.KZ: смотрите носителя, проходите тест и проверяйте себя камерой.",
        "Topic words from the SURDO.KZ dictionary: watch the signer, take the quiz and check yourself with the camera.",
        "SURDO.KZ сөздігінен тақырыптық сөздер: ым иесін көріп, тест тапсырып, камерамен тексеріңіз.",
      ),
      count: at("751 жест · уроки по темам", "751 signs · topic lessons", "751 ым · тақырыптық сабақтар"),
    },
    {
      id: 3,
      title: at("Фразы и диалоги", "Phrases and dialogues", "Сөйлемдер мен диалогтар"),
      description: at(
        "Бытовые фразы «Оян, Qazaqstan», видеоуроки «Саусақтар сөйлейді» и диалоги, где камера проверяет вашу реплику.",
        "Everyday «Оян, Qazaqstan» phrases, «Саусақтар сөйлейді» video lessons and dialogues where the camera checks your reply.",
        "«Оян, Qazaqstan» күнделікті сөйлемдері, «Саусақтар сөйлейді» бейнесабақтары және камера жауабыңызды тексеретін диалогтар.",
      ),
      count: at("14 фраз · 3 диалога · видеоуроки", "14 phrases · 3 dialogues · video lessons", "14 сөйлем · 3 диалог · бейнесабақтар"),
    },
  ];
}

export function KazakhStage({ stage }: { stage: number }) {
  const levels = kslLevels();
  const level = levels.find((l) => l.id === stage) ?? levels[0];
  return (
    <div className="sign-workspace sign-course-workspace ksl-stage">
      <Link className="sign-back" to="/learn?lang=ksl">
        <ArrowLeft size={18} />
        {at("Все уровни", "All levels", "Барлық деңгейлер")}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{at("КАЗАХСКИЙ ЖЕСТОВЫЙ ЯЗЫК", "KAZAKH SIGN LANGUAGE", "ҚАЗАҚ ЫМ ТІЛІ")}</span>
          <h1>{level.title}</h1>
          <p>{level.description}</p>
        </div>
        {level.id === 1 && (
          <Link className="button primary level-test-link" to="/kazakh?tab=trainer">
            <Camera size={18} />
            {at("Тренажёр с камерой", "Camera trainer", "Камерамен жаттығу")}
          </Link>
        )}
      </div>
      <StageTabs levels={levels} current={level.id} />
      {level.id === 1 && <Letters />}
      {level.id === 2 && <Topics />}
      {level.id === 3 && <KazakhTeacherSection />}
    </div>
  );
}

function Letters() {
  return (
    <>
      <p className="ksl-stage-legend">
        <span className="letter-tile-badge static">ҚАЗ</span>
        {at("— 9 букв, которых нет в русском дактиле", "— 9 letters not in Russian fingerspelling", "— орыс дактилінде жоқ 9 әріп")}
      </p>
      <div className="letter-tiles">
        {KSL_LETTERS.map((l) => (
          <LetterTile
            key={l}
            letter={l}
            to={`/kazakh?tab=alphabet&letter=${encodeURIComponent(l)}`}
            photo
            badge={KSL_KAZAKH_ONLY.includes(l) ? "ҚАЗ" : undefined}
            caption={at("Видео носителя", "Signer video", "Ым иесінің бейнесі")}
            media={<img src={`https://i.ytimg.com/vi/${SURDO_LETTER[l]}/mqdefault.jpg`} alt="" loading="lazy" />}
          />
        ))}
      </div>
    </>
  );
}

function Topics() {
  const { data, error } = useKslCatalog();
  const lessons = useMemo(() => (data ? kslLessons(data.entries) : []), [data]);
  if (error) return <p className="translate-status error">{at("Не удалось загрузить словарь.", "Could not load the dictionary.", "Сөздік жүктелмеді.")}</p>;
  if (!data) return <p>…</p>;
  const progress = readProgress();
  const next = lessons.find((l) => progress[l.id] === undefined) ?? lessons[0];
  return (
    <>
      <Link className="ksl-continue card-motion" to={`/course/kz/${next.id}`}>
        <span className="ksl-continue-icon"><Play size={20} /></span>
        <div>
          <strong>
            {at("Следующий урок", "Next lesson", "Келесі сабақ")}: {topicName(next.topic)}
            {next.parts > 1 ? ` · ${next.part}/${next.parts}` : ""}
          </strong>
          <span>
            {at("Пройдено", "Done", "Өтілді")} {lessons.filter((l) => progress[l.id] !== undefined).length} / {lessons.length}
          </span>
        </div>
        <ArrowRight size={18} />
      </Link>
      <div className="ksl-topic-grid">
        {lessons.map((l) => {
          const done = progress[l.id] !== undefined;
          return (
            <Link key={l.id} className={`ksl-topic-card card-motion${done ? " done" : ""}`} to={`/course/kz/${l.id}`}>
              <span className="ksl-topic-media">
                <img src={`https://i.ytimg.com/vi/${l.words[0].youtube}/mqdefault.jpg`} alt="" loading="lazy" />
                <span className="ksl-topic-num">{l.id}</span>
                {done && <span className="ksl-topic-done"><Check size={14} /> {at("Пройден", "Done", "Өтті")}</span>}
              </span>
              <span className="ksl-topic-body">
                <strong>
                  {topicName(l.topic)}
                  {l.parts > 1 ? ` · ${l.part}/${l.parts}` : ""}
                </strong>
                <span className="ksl-topic-words">
                  {l.words.slice(0, 3).map((w) => w.label.replace(/[!?]$/, "")).join(" · ")}
                  {l.words.length > 3 ? ` +${l.words.length - 3}` : ""}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
