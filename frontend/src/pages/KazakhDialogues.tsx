import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, MessageCircle, RotateCcw, X } from "lucide-react";
import { at } from "../i18n/automation";
import { useLanguage } from "../i18n";
import { shuffle } from "../sign/activities";
import { KslClip, useTeacherLessons, type Phrase, type TeacherLesson } from "./KazakhTeacher";
import { WordPracticeCamera } from "../components/WordPracticeCamera";
import { kslModelLabel, loadKslWordModel } from "../sign/wordRecognizer";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./fingerspell.css";
import "./course.css";

/** Kazakh SL dialogues built only from real Kazakh signer videos: the
 * «Оян, Qazaqstan» phrases and the «Саусақтар сөйлейді» words. In each turn
 * the learner reads the situation (and watches the partner, when the partner
 * signs), picks the right Kazakh reply, watches it signed, then can sign it to
 * the camera: ksl-words-v2 picks among the turn's options (words + the
 * «Оян, Qazaqstan» phrases, ml/ksl/train_ksl_phrases.py). */
type Turn = {
  /** What the partner signs first (video), if anything. */
  partner?: string;
  situation: [ru: string, kk: string];
  answer: string;
  distractors: string[];
};
export type KslScenario = { id: string; title: [ru: string, kk: string]; about: [ru: string, kk: string]; turns: Turn[] };

export const KSL_SCENARIOS: KslScenario[] = [
  {
    id: "tanysu",
    title: ["Знакомство", "Танысу"],
    about: ["Поздороваться, спросить, как дела, поблагодарить и попрощаться.", "Амандасу, хал сұрау, алғыс айту, қоштасу."],
    turns: [
      { situation: ["Вы встретили глухого коллегу. Поздоровайтесь вежливо.", "Әріптесіңізді кездестірдіңіз. Сыпайы амандасыңыз."], answer: "Сәлеметсіз бе!", distractors: ["Қайырлы түн!", "Сау болыңыз"] },
      { partner: "Халіңіз қалай?", situation: ["Коллега спрашивает. Ответьте, что всё отлично.", "Әріптесіңіз сұрайды. Бәрі керемет деп жауап беріңіз."], answer: "Керемет!", distractors: ["Кім?", "Кешірім сұраймын"] },
      { partner: "Аты", situation: ["Коллега спрашивает, как вас зовут. Покажите «имя», затем дактилем своё имя.", "Атыңызды сұрайды. «Аты» деп көрсетіп, атыңызды дактильмен көрсетіңіз."], answer: "Аты", distractors: ["Тегі", "Қайда?"] },
      { partner: "Күніңіз сәтті өтсін!", situation: ["Коллега желает удачного дня. Поблагодарите.", "Әріптесіңіз сәттілік тілейді. Алғыс айтыңыз."], answer: "Рахмет!", distractors: ["Неге?", "Керемет!"] },
      { situation: ["Пора уходить. Попрощайтесь.", "Кететін уақыт келді. Қоштасыңыз."], answer: "Сау болыңыз", distractors: ["Сәлеметсіз бе!", "Қайырлы таң!"] },
    ],
  },
  {
    id: "komek",
    title: ["Попросить о помощи", "Көмек сұрау"],
    about: ["На улице: обратиться к прохожему, попросить помочь и показать дорогу.", "Көшеде: адамға жүгіну, көмек және жол сұрау."],
    turns: [
      { situation: ["Вы на улице и хотите обратиться к прохожему. Начните с извинения.", "Көшеде адамға жүгінгіңіз келеді. Кешірім сұраудан бастаңыз."], answer: "Кешірім сұраймын", distractors: ["Мен сізді жақсы көремін", "Қайырлы кеш!"] },
      { situation: ["Попросите о помощи.", "Көмек сұраңыз."], answer: "Маған көмектесе аласыз ба?", distractors: ["Халіңіз қалай?", "Керемет!"] },
      { situation: ["Прохожий согласен. Вам нужна дорога: попросите подсказать её.", "Ол келісті. Жол көрсетуін сұраңыз."], answer: "Жол көрсетіңізші", distractors: ["Қашан?", "Сау болыңыз"] },
      { partner: "Қайда?", situation: ["Прохожий спрашивает: «Куда?». Ответьте: в школу.", "Ол «Қайда?» деп сұрайды. Мектепке деп жауап беріңіз."], answer: "Мектеп", distractors: ["Кітапхана", "Футбол"] },
      { situation: ["Вам помогли. Поблагодарите и пожелайте удачного дня.", "Сізге көмектесті. Алғыс айтып, сәттілік тілеңіз."], answer: "Рахмет!", distractors: ["Кешірім сұраймын", "Неге?"] },
      { situation: ["Пожелайте прохожему удачного дня.", "Сәттілік тілеңіз."], answer: "Күніңіз сәтті өтсін!", distractors: ["Қайырлы түн!", "Маған көмектесе аласыз ба?"] },
    ],
  },
  {
    id: "kun",
    title: ["Приветствия в течение дня", "Күн бойы амандасу"],
    about: ["Утро, день, вечер, ночь, а ещё «Кто?» и «Почему?» в разговоре.", "Таң, күн, кеш, түн және «Кім?», «Неге?» сұрақтары."],
    turns: [
      { situation: ["8:00. Вы пришли на занятия. Поздоровайтесь.", "08:00. Сабаққа келдіңіз. Амандасыңыз."], answer: "Қайырлы таң!", distractors: ["Қайырлы кеш!", "Қайырлы түн!"] },
      { situation: ["14:00. Вы встретили соседа.", "14:00. Көршіңізді кездестірдіңіз."], answer: "Қайырлы күн!", distractors: ["Қайырлы таң!", "Қайырлы түн!"] },
      { partner: "Кім?", situation: ["Сосед спрашивает, кто это с вами. Это ваша мама.", "Көршіңіз қасыңыздағы кім екенін сұрайды. Бұл — анаңыз."], answer: "Ана", distractors: ["Әке", "Әже"] },
      { situation: ["19:00. Вы пришли в гости.", "19:00. Қонаққа келдіңіз."], answer: "Қайырлы кеш!", distractors: ["Қайырлы таң!", "Қайырлы күн!"] },
      { partner: "Неге?", situation: ["Хозяин спрашивает: «Почему уходите?». Извинитесь.", "«Неге кетесіз?» деп сұрайды. Кешірім сұраңыз."], answer: "Кешірім сұраймын", distractors: ["Керемет!", "Мен сізді жақсы көремін"] },
      { situation: ["22:00. Пожелайте спокойной ночи.", "22:00. Жақсы түн тілеңіз."], answer: "Қайырлы түн!", distractors: ["Қайырлы кеш!", "Сәлеметсіз бе!"] },
    ],
  },
];

type Clip = { youtube: string; start: number; end: number; kk: string; ru: string };
function clipIndex(phrases: Phrase[], lessons: TeacherLesson[]) {
  const m = new Map<string, Clip>();
  for (const l of lessons) for (const w of l.words) m.set(w.kk, { ...w, youtube: l.youtube });
  for (const p of phrases) m.set(p.kk, p); // phrases (several signers) win
  return m;
}

/** Cards for the course page and the Dialogues page (ҚЖЯ). */
export function KazakhDialogueCards() {
  return (
    <div className="ksl-teacher-grid ksl-dialogue-grid">
      {KSL_SCENARIOS.map((s, k) => (
        <Link key={s.id} className={`panel ksl-teacher-card ksl-dialogue-card tone-${k % 3} card-motion`} to={`/course/kz/dialogue/${s.id}`}>
          <span className="ksl-feature-icon"><MessageCircle size={20} /></span>
          <strong>{at(s.title[0], s.title[0], s.title[1])}</strong>
          <span>{at(s.about[0], s.about[0], s.about[1])}</span>
          <span>{at(`${s.turns.length} реплик`, `${s.turns.length} turns`, `${s.turns.length} реплика`)}</span>
        </Link>
      ))}
    </div>
  );
}

export function KazakhDialoguePage() {
  const { id } = useParams();
  const { data, error } = useTeacherLessons();
  const { language } = useLanguage();
  const showRu = language !== "kk";
  const scenario = KSL_SCENARIOS.find((s) => s.id === id) ?? KSL_SCENARIOS[0];
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [replay, setReplay] = useState(0);
  const [camera, setCamera] = useState(false);
  const [signed, setSigned] = useState<Set<number>>(new Set());
  const [labels, setLabels] = useState<string[]>([]);
  useEffect(() => {
    loadKslWordModel().then((m) => setLabels(m.labels), () => setLabels([]));
  }, []);
  const clips = useMemo(() => (data ? clipIndex(data.phrases.items, data.teacher.lessons) : null), [data]);
  const turn = scenario.turns[i];
  const options = useMemo(() => (turn ? shuffle([turn.answer, ...turn.distractors]) : []), [turn]);
  if (error) return <p className="translate-status error">{at("Не удалось загрузить видео.", "Could not load videos.", "Бейнелер жүктелмеді.")}</p>;
  if (!clips) return <p>…</p>;
  const ru = (kk: string) => clips.get(kk)?.ru ?? "";
  const restart = () => { setI(0); setPicked(null); setScore(0); setSigned(new Set()); };
  const toModel = (kk: string) => kslModelLabel(kk, labels);
  const textOf = (label: string) => [turn?.answer, ...(turn?.distractors ?? [])].find((o) => o && toModel(o) === label) ?? label;
  const next = KSL_SCENARIOS[KSL_SCENARIOS.indexOf(scenario) + 1];
  const shown = picked ? clips.get(turn?.answer ?? "") : turn?.partner ? clips.get(turn.partner) : undefined;
  return (
    <div className="sign-workspace vocab fingerspell course">
      <Link className="text-link back-link" to="/course">
        <ArrowLeft size={16} /> {at("Все уроки ҚЖЯ", "All Kazakh SL lessons", "Барлық ҚЫТ сабақтары")}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ҚЖЯ · {at("ДИАЛОГ", "DIALOGUE", "ДИАЛОГ")}</span>
          <h1>{showRu ? `${scenario.title[1]} · ${scenario.title[0]}` : scenario.title[1]}</h1>
          <p>{at(scenario.about[0], scenario.about[0], scenario.about[1])}</p>
        </div>
      </div>
      {!turn ? (
        <section className="panel fs-done">
          <CheckCircle2 size={40} />
          <h2>{at("Диалог пройден", "Dialogue complete", "Диалог аяқталды")}: {score} / {scenario.turns.length}</h2>
          {signed.size > 0 && (
            <p>{at("Показано в камеру и узнано", "Signed to the camera and recognized", "Камераға көрсетіліп, танылды")}: {signed.size} / {scenario.turns.length}</p>
          )}
          <div className="fs-actions">
            {next && (
              <Link className="button primary" to={`/course/kz/dialogue/${next.id}`} onClick={restart}>
                {at("Следующий диалог", "Next dialogue", "Келесі диалог")}: {at(next.title[0], next.title[0], next.title[1])} <ArrowRight size={16} />
              </Link>
            )}
            <button className="button secondary" onClick={restart}><RotateCcw size={16} /> {at("Ещё раз", "Again", "Қайта")}</button>
          </div>
        </section>
      ) : (
        <div className="fs-round">
          <section className="panel fs-player">
            {shown ? (
              <KslClip id={shown.youtube} start={shown.start} end={shown.end} replay={replay} />
            ) : (
              <div className="ksl-dialog-empty">{at("Ваша реплика", "Your turn", "Сіздің кезегіңіз")}</div>
            )}
            {picked ? (
              <>
                <strong className="course-word">{turn.answer}</strong>
                {showRu && <span className="course-word-ru">{ru(turn.answer)}</span>}
                <span className="eyebrow">{at("Так это показывают", "This is how it is signed", "Былай көрсетеді")}</span>
              </>
            ) : turn.partner ? (
              <span className="eyebrow">{at("Собеседник показывает…", "Your partner signs…", "Әңгімелесуші көрсетеді…")}</span>
            ) : null}
            {shown && (
              <button className="button secondary" onClick={() => setReplay((r) => r + 1)}>
                <RotateCcw size={16} /> {at("Ещё раз", "Again", "Қайта")}
              </button>
            )}
          </section>
          <section className="panel fs-answer">
            <span className="eyebrow">{i + 1} / {scenario.turns.length}</span>
            <h2>{at(turn.situation[0], turn.situation[0], turn.situation[1])}</h2>
            <div className="vocab-choices">
              {options.map((o) => (
                <button key={o} className={!picked ? "" : o === turn.answer ? "right" : o === picked ? "wrong" : ""} onClick={() => { if (picked) return; setPicked(o); setReplay(0); if (o === turn.answer) setScore((s) => s + 1); }}>
                  {o}
                  {showRu && ru(o) && <small className="course-word-ru">{ru(o)}</small>}
                </button>
              ))}
            </div>
            {picked && (
              <>
                <p className={`vocab-feedback ${picked === turn.answer ? "ok" : "no"}`}>
                  {picked === turn.answer ? <Check size={18} /> : <X size={18} />}{" "}
                  {picked === turn.answer ? at("Верно! Повторите жест за видео.", "Correct! Repeat the sign.", "Дұрыс! Ымды қайталаңыз.") : at(`Правильно: ${turn.answer}. Повторите жест за видео.`, `Correct: ${turn.answer}`, `Дұрысы: ${turn.answer}`)}
                </p>
                <div className="fs-actions">
                  {!camera && (
                    <button className="button secondary" onClick={() => setCamera(true)}>
                      <Camera size={16} /> {at("Покажи реплику в камеру", "Sign it to the camera", "Камераға көрсетіңіз")}
                    </button>
                  )}
                  <button className="button primary" onClick={() => { setPicked(null); setI((n) => n + 1); }}>{at("Дальше", "Next", "Келесі")} <ArrowRight size={16} /></button>
                </div>
                {signed.has(i) && (
                  <p className="vocab-feedback ok"><Check size={18} /> {at("Камера узнала вашу реплику", "The camera recognized your reply", "Камера жауабыңызды таныды")}</p>
                )}
              </>
            )}
          </section>
          {picked && camera && (
            <section className="ksl-dialog-camera">
              <WordPracticeCamera
                target={toModel(turn.answer)}
                choices={[turn.answer, ...turn.distractors].map(toModel)}
                loadModel={loadKslWordModel}
                display={textOf}
                onCorrect={() => setSigned((s) => new Set(s).add(i))}
              />
              <p className="fs-credit">
                {at(
                  "ИИ выбирает из вариантов этой реплики. Он учился на видео носителей ҚЖЯ и на новых людях угадывает примерно 6 раз из 10 — если не узнал, повторите чётче и медленнее.",
                  "The AI picks among this turn's options. Trained on Kazakh signer videos, it is right about 6 times in 10 on new people.",
                  "ЖИ осы репликаның нұсқаларынан таңдайды. Жаңа адамдарда шамамен 10-нан 6 рет дұрыс табады.",
                )}
              </p>
            </section>
          )}
        </div>
      )}
      <p className="fs-credit">
        {at("Видео: ", "Video: ", "Бейне: ")}«Оян, Qazaqstan» (Седьмой канал), «Саусақтар сөйлейді» · {at("официальный плеер YouTube", "official YouTube player", "YouTube ресми ойнатқышы")}
      </p>
    </div>
  );
}
