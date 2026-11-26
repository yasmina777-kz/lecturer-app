import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, HeartHandshake, MessageCircle, RotateCcw, Users, Video, X } from "lucide-react";
import { at } from "../i18n/automation";
import { useLanguage } from "../i18n";
import { shuffle } from "../sign/activities";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./fingerspell.css";
import "./course.css";
import { KazakhDialogueCards } from "./KazakhDialogues";
import { YouTubeClip } from "../components/YouTubeClip";

/** Kazakh SL video lessons from YouTube (embedded, never copied):
 * «Саусақтар сөйлейді» topic lessons with two Kazakh teachers, and
 * «Оян, Qazaqstan» everyday phrases shown by an interpreter and by deaf
 * passers-by. Built by ml/ksl/build_teacher_lessons.py. */
export type TeacherWord = { kk: string; ru: string; start: number; end: number };
export type TeacherLesson = { youtube: string; kk: string; ru: string; words: TeacherWord[] };
export type Phrase = { youtube: string; start: number; end: number; kk: string; ru: string };
type Data = { teacher: { channel: string; lessons: TeacherLesson[] }; phrases: { channel: string; items: Phrase[] } };

let loading: Promise<Data> | null = null;
export function loadTeacherLessons() {
  loading ??= fetch("/research/ksl/teacher-lessons.json").then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });
  return loading;
}
export function useTeacherLessons() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadTeacherLessons().then(setData, () => setError(true));
  }, []);
  return { data, error };
}

const norm = (s: string) => s.replace(/[!?.]/g, "").replace(/\(.*?\)/g, "").trim().toLocaleLowerCase("kk");
/** Teacher segment for a SURDO.KZ dictionary word, if a teacher lesson shows it too. */
export function teacherSegment(data: Data | null, label: string): (TeacherWord & { youtube: string }) | null {
  if (!data) return null;
  const k = norm(label);
  for (const l of data.teacher.lessons)
    for (const w of l.words) if (norm(w.kk) === k || (k === "сәлеметсізбе" && norm(w.kk).startsWith("сәлеметсіз"))) return { ...w, youtube: l.youtube };
  return null;
}

/** A piece of a YouTube video (official player, start/end in seconds). */
export function KslClip({ id, start, end, wide = true, replay = 0 }: { id: string; start?: number; end?: number; wide?: boolean; replay?: number }) {
  return <YouTubeClip id={id} start={start} end={end} loop={false} replay={replay} className={`ksl-yt${wide ? " wide" : ""}`} />;
}

const kkRu = (kk: string, ru: string, showRu: boolean) => (showRu ? `${kk} — ${ru}` : kk);

/** Cards on the course page (ҚЖЯ): everyday phrases + teacher video lessons. */
/** Course practice: dialogues, teacher video lessons and everyday phrases as
 * tabs (one list at a time), plus a slim "help train the AI" strip. */
export function KazakhTeacherSection() {
  const { data } = useTeacherLessons();
  const { language } = useLanguage();
  const [tab, setTab] = useState<"dialogues" | "videos" | "phrases">("dialogues");
  if (!data) return null;
  const phrases = [...new Map(data.phrases.items.map((p) => [p.kk, p])).values()];
  const tabs = [
    { id: "dialogues" as const, icon: MessageCircle, label: at("Диалоги", "Dialogues", "Диалогтар"), count: 3 },
    { id: "videos" as const, icon: Video, label: at("Видеоуроки", "Video lessons", "Бейнесабақтар"), count: data.teacher.lessons.length },
    { id: "phrases" as const, icon: Users, label: at("Фразы", "Phrases", "Сөйлемдер"), count: phrases.length },
  ];
  return (
    <section className="ksl-practice">
      <div className="ksl-practice-head">
        <h2>{at("Практика", "Practice", "Жаттығу")}</h2>
        <div className="ksl-practice-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              <t.icon size={16} /> {t.label} <small>{t.count}</small>
            </button>
          ))}
        </div>
      </div>
      {tab === "dialogues" && (
        <>
          <p className="ksl-practice-note">{at("Ситуации из реальных видео казахских носителей: выберите ответ и покажите реплику в камеру.", "Situations from real Kazakh signer videos: pick the reply and sign it to the camera.", "Қазақ ым тілі иелерінің бейнелерінен: жауапты таңдап, камераға көрсетіңіз.")}</p>
          <KazakhDialogueCards />
        </>
      )}
      {tab === "videos" && (
        <>
          <p className="ksl-practice-note">«Саусақтар сөйлейді», {at("Актобе: уроки преподавателя по темам.", "Aktobe: a teacher's topic lessons.", "Ақтөбе: мұғалімнің тақырыптық сабақтары.")}</p>
          <div className="ksl-teacher-grid">
            {data.teacher.lessons.map((l) => (
              <Link key={l.youtube} className="panel ksl-teacher-card card-motion" to={`/course/kz/teacher/${l.youtube}`}>
                <img src={`https://i.ytimg.com/vi/${l.youtube}/mqdefault.jpg`} alt="" loading="lazy" />
                <strong>{at(l.ru, l.ru, l.kk)}</strong>
                <span>{l.words.length ? at(`${l.words.length} жестов`, `${l.words.length} signs`, `${l.words.length} ым`) : at("урок целиком", "full lesson", "толық сабақ")}</span>
              </Link>
            ))}
          </div>
        </>
      )}
      {tab === "phrases" && (
        <>
          <p className="ksl-practice-note">{at("Показывают сурдопереводчик и глухие жители Астаны («Оян, Qazaqstan»).", "Shown by an interpreter and deaf people of Astana («Оян, Qazaqstan»).", "Ым тілі аудармашысы мен Астананың естімейтін тұрғындары көрсетеді («Оян, Qazaqstan»).")}</p>
          <div className="ksl-phrase-chips">
            {phrases.map((p) => (
              <Link key={p.kk} to="/course/kz/phrases">
                <strong>{p.kk}</strong>
                {language !== "kk" && <small>{p.ru}</small>}
              </Link>
            ))}
          </div>
          <Link className="button primary ksl-practice-go" to="/course/kz/phrases">
            {at("Учить фразы", "Learn the phrases", "Сөйлемдерді үйрену")} <ArrowRight size={16} />
          </Link>
        </>
      )}
      <Link className="ksl-help-strip" to="/record-signs?lang=ksl">
        <HeartHandshake size={18} />
        <span>
          <b>{at("Помогите обучить ИИ казахским жестам", "Help train the AI on Kazakh signs", "ЖИ-ді қазақ ымдарына үйретуге көмектесіңіз")}</b>
          {" · "}
          {at("15 минут, сохраняются только точки рук. Ссылка для друзей: /help-ksl", "15 minutes, only hand points are saved. Link for friends: /help-ksl", "15 минут, тек қол нүктелері сақталады. Достарға: /help-ksl")}
        </span>
        <ArrowRight size={16} />
      </Link>
    </section>
  );
}

export function KazakhTeacherLessonPage() {
  const { vid } = useParams();
  const { data, error } = useTeacherLessons();
  const { language } = useLanguage();
  const showRu = language !== "kk";
  const [sel, setSel] = useState(0);
  const [replay, setReplay] = useState(0);
  useEffect(() => setSel(0), [vid]);
  if (error) return <p className="translate-status error">{at("Не удалось загрузить уроки.", "Could not load lessons.", "Сабақтар жүктелмеді.")}</p>;
  if (!data) return <p>…</p>;
  const lessons = data.teacher.lessons;
  const lesson = lessons.find((l) => l.youtube === vid) ?? lessons[0];
  const next = lessons[lessons.indexOf(lesson) + 1];
  const w = lesson.words[sel];
  return (
    <div className="sign-workspace vocab fingerspell course">
      <Link className="text-link back-link" to="/course">
        <ArrowLeft size={16} /> {at("Все уроки ҚЖЯ", "All Kazakh SL lessons", "Барлық ҚЫТ сабақтары")}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ҚЖЯ · {at("ВИДЕОУРОК", "VIDEO LESSON", "БЕЙНЕСАБАҚ")}</span>
          <h1>{showRu ? `${lesson.kk} · ${lesson.ru}` : lesson.kk}</h1>
          <p>{at("Преподаватель «Саусақтар сөйлейді» показывает каждый жест дважды: общим и крупным планом.", "The teacher shows every sign twice: wide and close-up.", "Мұғалім әр ымды екі рет көрсетеді: жалпы және ірі планда.")}</p>
        </div>
      </div>
      <div className="fs-round">
        <section className="panel fs-player">
          <KslClip id={lesson.youtube} start={w?.start} end={w?.end} replay={replay} />
          {w && <strong className="course-word">{w.kk}</strong>}
          {w && showRu && <span className="course-word-ru">{w.ru}</span>}
          {w && (
            <button className="button secondary" onClick={() => setReplay((r) => r + 1)}>
              <RotateCcw size={16} /> {at("Ещё раз", "Again", "Қайта")}
            </button>
          )}
        </section>
        <section className="panel fs-answer">
          <h2>{lesson.words.length ? at("Выберите жест и повторите за преподавателем", "Pick a sign and repeat it", "Ымды таңдап, мұғаліммен бірге қайталаңыз") : at("Смотрите урок целиком", "Watch the whole lesson", "Сабақты толық қараңыз")}</h2>
          <div className="vocab-chips course-chips">
            {lesson.words.map((x, k) => (
              <button key={x.kk} aria-pressed={k === sel} onClick={() => setSel(k)}>
                {x.kk}
              </button>
            ))}
          </div>
          {next && (
            <Link className="button primary" to={`/course/kz/teacher/${next.youtube}`}>
              {at("Следующий видеоурок", "Next video lesson", "Келесі бейнесабақ")}: {at(next.ru, next.ru, next.kk)} <ArrowRight size={16} />
            </Link>
          )}
        </section>
      </div>
      <p className="fs-credit">
        {at("Видео: ", "Video: ", "Бейне: ")}
        <a href={data.teacher.channel} target="_blank" rel="noreferrer">YouTube «Саусақтар сөйлейді»</a> · {at("официальный плеер YouTube", "official YouTube player", "YouTube ресми ойнатқышы")}
      </p>
    </div>
  );
}

/** Everyday phrases: watch (several signers per phrase) → quiz. */
export function KazakhPhrasesPage() {
  const { data, error } = useTeacherLessons();
  const { language } = useLanguage();
  const showRu = language !== "kk";
  const [step, setStep] = useState(0);
  if (error) return <p className="translate-status error">{at("Не удалось загрузить фразы.", "Could not load phrases.", "Сөйлемдер жүктелмеді.")}</p>;
  if (!data) return <p>…</p>;
  const items = data.phrases.items;
  return (
    <div className="sign-workspace vocab fingerspell course">
      <Link className="text-link back-link" to="/course">
        <ArrowLeft size={16} /> {at("Все уроки ҚЖЯ", "All Kazakh SL lessons", "Барлық ҚЫТ сабақтары")}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ҚЖЯ · {at("ФРАЗЫ", "PHRASES", "СӨЙЛЕМДЕР")}</span>
          <h1>{at("Фразы на каждый день", "Everyday phrases", "Күнделікті сөйлемдер")}</h1>
          <p>
            <Users size={15} /> {at("Каждую фразу показывают несколько человек: сурдопереводчик и глухие жители Астаны. Так видно, как один жест выглядит у разных людей.", "Each phrase is shown by several people.", "Әр сөйлемді бірнеше адам көрсетеді: аудармашы және Астананың естімейтін тұрғындары.")}
          </p>
        </div>
      </div>
      <ol className="course-steps">
        {[at("Смотрим", "Watch", "Қараймыз"), at("Узнай фразу", "Recognise", "Сөйлемді тану"), at("Готово", "Done", "Дайын")].map((s, k) => (
          <li key={k}>
            <button aria-current={k === step ? "step" : undefined} className={k < step ? "past" : ""} onClick={() => setStep(k)}>
              <span>{k < step ? <Check size={14} /> : k + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      {step === 0 ? (
        <PhraseWatch items={items} showRu={showRu} onNext={() => setStep(1)} />
      ) : step === 1 ? (
        <PhraseQuiz items={items} showRu={showRu} onDone={() => setStep(2)} />
      ) : (
        <section className="panel fs-done">
          <CheckCircle2 size={40} />
          <h2>{at("Отлично! Фразы пройдены.", "Well done!", "Керемет! Сөйлемдер өтілді.")}</h2>
          <div className="fs-actions">
            <Link className="button primary" to="/course">{at("К урокам ҚЖЯ", "To Kazakh SL lessons", "ҚЫТ сабақтарына")} <ArrowRight size={16} /></Link>
          </div>
        </section>
      )}
      <p className="fs-credit">
        {at("Видео: ", "Video: ", "Бейне: ")}
        <a href={data.phrases.channel} target="_blank" rel="noreferrer">«Оян, Qazaqstan», Седьмой канал</a> · {at("официальный плеер YouTube", "official YouTube player", "YouTube ресми ойнатқышы")}
      </p>
    </div>
  );
}

function PhraseWatch({ items, showRu, onNext }: { items: Phrase[]; showRu: boolean; onNext: () => void }) {
  const [sel, setSel] = useState(0);
  const [replay, setReplay] = useState(0);
  const p = items[sel];
  return (
    <div className="fs-round">
      <section className="panel fs-player">
        <KslClip id={p.youtube} start={p.start} end={p.end} replay={replay} />
        <strong className="course-word">{p.kk}</strong>
        {showRu && <span className="course-word-ru">{p.ru}</span>}
        <button className="button secondary" onClick={() => setReplay((r) => r + 1)}>
          <RotateCcw size={16} /> {at("Ещё раз", "Again", "Қайта")}
        </button>
      </section>
      <section className="panel fs-answer">
        <h2>{at("Посмотрите фразу и повторите её", "Watch and repeat", "Сөйлемді қарап, қайталаңыз")}</h2>
        <div className="vocab-chips course-chips">
          {items.map((x, k) => (
            <button key={x.kk} aria-pressed={k === sel} onClick={() => setSel(k)}>
              {x.kk}
            </button>
          ))}
        </div>
        <button className="button primary" onClick={onNext}>
          {at("Проверить себя", "Check yourself", "Өзіңді тексер")} <ArrowRight size={16} />
        </button>
      </section>
    </div>
  );
}

function PhraseQuiz({ items, showRu, onDone }: { items: Phrase[]; showRu: boolean; onDone: () => void }) {
  const qs = useMemo(() => shuffle(items).slice(0, 6), [items]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const t = qs[i];
  const options = useMemo(() => (t ? shuffle([t, ...shuffle(items.filter((x) => x !== t)).slice(0, 3)]) : []), [t, items]);
  if (!t)
    return (
      <section className="panel fs-done">
        <h2>{at("Проверка", "Check", "Тексеру")}: {score} / {qs.length}</h2>
        <button className="button primary" onClick={onDone}>{at("Дальше", "Next", "Келесі")} <ArrowRight size={16} /></button>
      </section>
    );
  return (
    <div className="fs-round">
      <section className="panel fs-player">
        {/* the TV caption bar and the on-screen text name the phrase: hide them and the YouTube title */}
        <div className="ksl-quiz-video">
          <KslClip id={t.youtube} start={t.start} end={t.end} />
          <span className="ksl-mask-title" aria-hidden="true" />
          <span className="ksl-mask-caption" aria-hidden="true" />
          <span className="ksl-mask-phrase" aria-hidden="true" />
        </div>
      </section>
      <section className="panel fs-answer">
        <span className="eyebrow">{i + 1} / {qs.length}</span>
        <h2>{at("Какая это фраза?", "Which phrase is it?", "Бұл қандай сөйлем?")}</h2>
        <div className="vocab-choices">
          {options.map((o) => (
            <button key={o.kk} className={!picked ? "" : o === t ? "right" : o.kk === picked ? "wrong" : ""} onClick={() => { if (picked) return; setPicked(o.kk); if (o === t) setScore((s) => s + 1); }}>
              {o.kk}
              {showRu && <small className="course-word-ru">{o.ru}</small>}
            </button>
          ))}
        </div>
        {picked && (
          <>
            <p className={`vocab-feedback ${picked === t.kk ? "ok" : "no"}`}>{picked === t.kk ? <Check size={18} /> : <X size={18} />} {kkRu(t.kk, t.ru, showRu)}</p>
            <button className="button primary" onClick={() => { setPicked(null); setI((n) => n + 1); }}>{at("Дальше", "Next", "Келесі")} <ArrowRight size={16} /></button>
          </>
        )}
      </section>
    </div>
  );
}
