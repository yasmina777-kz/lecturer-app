import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Baby,
  BedDouble,
  Bird,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Calculator,
  CalendarClock,
  CalendarDays,
  Car,
  Cat,
  Check,
  CheckCircle2,
  ChefHat,
  Circle,
  CircleCheck,
  CircleHelp,
  Clock,
  CloudSun,
  Coffee,
  Coins,
  CreditCard,
  Croissant,
  CupSoda,
  Dice5,
  Dog,
  Drama,
  Dumbbell,
  Ear,
  Fish,
  Flag,
  Frown,
  Gamepad2,
  Gauge,
  Gift,
  GitBranch,
  GraduationCap,
  Hand,
  Handshake,
  Hash,
  Heart,
  HeartHandshake,
  HeartPulse,
  History,
  Home,
  House,
  Infinity,
  KeyRound,
  Laugh,
  Leaf,
  Lightbulb,
  Luggage,
  MapPin,
  Meh,
  MessageCircle,
  MessageSquare,
  MessagesSquare,
  Minus,
  Moon,
  Mountain,
  Orbit,
  Palette,
  PartyPopper,
  PawPrint,
  PenLine,
  PersonStanding,
  Pill,
  Plane,
  Play,
  Plus,
  Pointer,
  Quote,
  Repeat,
  Repeat2,
  Ruler,
  Salad,
  Scale,
  ScrollText,
  Search,
  Shapes,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smile,
  Snowflake,
  Soup,
  Sparkles,
  Sprout,
  Star,
  Stethoscope,
  Store,
  Sun,
  Sunrise,
  Tag,
  Thermometer,
  ThumbsDown,
  ThumbsUp,
  Ticket,
  TrafficCone,
  Trees,
  TrendingUp,
  Type,
  Umbrella,
  UserRound,
  Users,
  UsersRound,
  UtensilsCrossed,
  Video,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { at } from "../i18n/automation";
import { phraseText, tipText, useSignLang, wordText } from "../sign/signLanguage";
import { useChooseSignLang } from "../components/SignLangSwitcher";
import { KazakhCourseList } from "./KazakhCourse";
import "../components/topic-art.css";
import { ProgressRing } from "../components/ProgressRing";
import { PlacementPrompt } from "../components/PlacementPrompt";
import { readPlacement } from "../sign/levelTests";
import { SignChain } from "../components/SignChain";
import { WordPracticeCamera } from "../components/WordPracticeCamera";
import { courseUnits, levelOf, type CefrLevel, type CourseUnit } from "../sign/courseUnits";
import { shuffle } from "../sign/activities";
import { useActivityCatalog } from "../sign/useActivities";
import type { DictionaryEntry } from "../sign/dictionary";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./fingerspell.css";
import "./sign-grammar.css";
import "./course.css";

const KEY = "rsl-course-v1";
type Progress = Record<string, { done?: boolean; step?: number; quiz?: number }>;
function readProgress(): Progress {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}
function save(id: number, patch: Progress[string]) {
  const p = readProgress();
  p[id] = { ...p[id], ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}
const STEPS = () => [
  at("Новые жесты", "New signs", "Жаңа ымдар"),
  at("Узнай жест", "Recognise", "Ымды тану"),
  at("Фразы", "Phrases", "Сөйлемдер"),
  at("Покажи сам", "Sign it", "Өзің көрсет"),
  at("Грамматика и диалог", "Grammar & dialogue", "Грамматика мен диалог"),
  at("Готово", "Done", "Дайын"),
];

const ART: Record<number, [LucideIcon, LucideIcon[]]> = {
  1: [Hand, [MessageCircle, Smile, UserRound]],
  2: [Users, [Heart, Baby, House]],
  3: [Hash, [Calculator, Dice5, Plus]],
  4: [Clock, [CalendarDays, Sun, Moon]],
  5: [Wallet, [ShoppingCart, Coins, Tag]],
  6: [Sunrise, [Briefcase, BedDouble, House]],
  7: [Coffee, [UtensilsCrossed, CupSoda, Croissant]],
  8: [Heart, [Smile, Frown, Laugh]],
  9: [Stethoscope, [Pill, HeartPulse, Thermometer]],
  10: [BookOpen, [PenLine, GraduationCap, Lightbulb]],
  11: [PawPrint, [Palette, Cat, Dog]],
  12: [CloudSun, [Snowflake, Umbrella, Leaf]],
  101: [UsersRound, [UserRound, Handshake, Heart]],
  102: [Smile, [Ruler, Sparkles, Dumbbell]],
  103: [Building2, [MapPin, Store, TrafficCone]],
  104: [Plane, [Luggage, Ticket, KeyRound]],
  105: [Repeat, [CalendarClock, Clock, Infinity]],
  106: [CalendarDays, [Gamepad2, Sun, House]],
  107: [ShoppingBag, [CreditCard, Shirt, Gift]],
  108: [UtensilsCrossed, [ChefHat, Soup, Salad]],
  109: [HeartHandshake, [ThumbsUp, Meh, PartyPopper]],
  110: [Briefcase, [Search, CircleCheck, Brain]],
  111: [Trees, [Fish, Sun, Bird]],
  112: [MessagesSquare, [CircleHelp, Check, Ear]],
  201: [Orbit, [MapPin, Pointer, Users]],
  202: [Shapes, [Car, PersonStanding, Hand]],
  203: [Quote, [MessageSquare, Repeat2, UserRound]],
  204: [History, [ArrowRight, Flag, Clock]],
  205: [GitBranch, [CircleHelp, Lightbulb, ArrowRight]],
  206: [Scale, [ThumbsUp, ThumbsDown, MessageCircle]],
  207: [Gauge, [Plus, Minus, TrendingUp]],
  208: [ScrollText, [Star, Heart, Smile]],
};

/** Topic illustration for a lesson card: a big theme icon on a level-coloured
 * gradient with three small floating icons (vector, crisp, no downloads). */
// Illustrated scenes of people signing, picked to match each lesson's topic.
const UNIT_PHOTO: Record<number, number> = { 13: 22, 14: 32, 15: 7, 16: 30, 113: 21, 114: 29, 115: 7, 116: 16, 117: 31, 118: 22, 119: 20, 120: 15, 209: 1, 210: 32, 211: 21, 212: 29,
  1: 1, 2: 17, 3: 7, 4: 29, 5: 27, 6: 24, 7: 25, 8: 21, 9: 30, 10: 10, 11: 22, 12: 32,
  101: 23, 102: 20, 103: 31, 104: 28, 105: 12, 106: 29, 107: 27, 108: 26, 109: 8, 110: 11, 111: 32, 112: 2,
  201: 5, 202: 6, 203: 18, 204: 9, 205: 3, 206: 4, 207: 19, 208: 16,
};
const scene = (n: number) => `/illustrations/sign-phrases/phrase-${String(n).padStart(2, "0")}.jpg`;
function UnitArt({ id }: { id: number; index: number }) {
  return <img className="topic-photo" src={scene(UNIT_PHOTO[id] ?? 1)} alt="" loading="lazy" />;
}

const LEVELS: { id: CefrLevel; title: string; name: string; desc: string; icon: typeof Sprout }[] = [
  { id: "A1", title: "A1", name: "Выживание", desc: "Знакомство, семья, числа, время, покупки, еда", icon: Sprout },
  { id: "A2", title: "A2", name: "Быт", desc: "Люди, город, путешествия, неделя, ресторан, мнения", icon: Home },
  { id: "B1", title: "B1", name: "Связная речь", desc: "Пространство, классификаторы, рассказ, мнение", icon: MessagesSquare },
  { id: "B2", title: "B2+", name: "Свобода", desc: "Нужен материал носителей языка", icon: Mountain },
];


const B2_SKILLS = () => [
  { icon: Video, title: at("Живая речь", "Natural speech", "Тірі сөйлеу"), text: at("Понимать длинные рассказы носителей в обычном темпе.", "Follow long stories at natural speed.", "Ұзын әңгімелерді түсіну.") },
  { icon: Shapes, title: at("Классификаторы", "Classifiers", "Классификаторлар"), text: at("Показывать форму, размер и движение предметов руками.", "Show shape, size and motion with handshapes.", "Пішін мен қозғалысты көрсету.") },
  { icon: Drama, title: at("Ролевой сдвиг", "Role shift", "Рөлдік ауысу"), text: at("Говорить «за героя» корпусом и взглядом, шутить, рассказывать.", "Speak as a character with body and gaze.", "Кейіпкер атынан сөйлеу.") },
  { icon: Briefcase, title: at("Сложная лексика", "Advanced vocabulary", "Күрделі сөздік"), text: at("Работа, наука, медицина, право — тысячи жестов.", "Work, science, medicine, law — thousands of signs.", "Мыңдаған ым.") },
];

function B2Roadmap({ count, onPick }: { count: (l: CefrLevel) => number[]; onPick: (l: CefrLevel) => void }) {
  const path = LEVELS.slice(0, 3);
  return (
    <div className="b2 course-anim">
      <section className="panel b2-path">
        <h2>{at("Ваш путь к B2", "Your path to B2", "B2-ге жол")}</h2>
        <ol className="b2-steps">
          {path.map((l) => {
            const [d, t] = count(l.id);
            const pct = t ? Math.round((d / t) * 100) : 0;
            const Icon = l.icon;
            return (
              <li key={l.id} className={d === t && t ? "done" : ""} data-level={l.id}>
                <button onClick={() => onPick(l.id)}>
                  <span className="b2-step-icon">{d === t && t ? <Check size={22} /> : <Icon size={22} />}</span>
                  <strong>{l.title}</strong>
                  <small>{l.name}</small>
                  <span className="b2-bar"><i style={{ width: `${pct}%` }} /></span>
                  <small>{d}/{t}</small>
                </button>
              </li>
            );
          })}
          <li className="goal" data-level="B2">
            <div>
              <span className="b2-step-icon"><Mountain size={22} /></span>
              <strong>B2+</strong>
              <small>{at("Свобода", "Fluency", "Еркіндік")}</small>
              <span className="b2-flag"><Flag size={14} /> {at("цель", "goal", "мақсат")}</span>
            </div>
          </li>
        </ol>
      </section>

      <h2 className="b2-heading">{at("Что умеет человек на B2", "What a B2 signer can do", "B2 деңгейінде не істей алады")}</h2>
      <div className="b2-skills">
        {B2_SKILLS().map((s) => (
          <article key={s.title} className="panel b2-skill">
            <span className="b2-skill-icon"><s.icon size={24} /></span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </article>
        ))}
      </div>

      <section className="panel b2-why">
        <span className="b2-skill-icon"><HeartHandshake size={24} /></span>
        <div>
          <h3>{at("Почему этого уровня ещё нет в курсе", "Why this level is not in the course yet", "Неге бұл деңгей әлі жоқ")}</h3>
          <p>{at("Для B2 нужны длинные видео носителей и проверка преподавателем РЖЯ — в открытых данных их нет. Мы не хотим учить вас неправильно, поэтому честно ведём туда через живую практику.", "B2 needs long native-signer videos and a teacher's review, which open data lacks. Until then we guide you there through live practice.", "B2 үшін ана тілді адамдардың видеолары керек.")}</p>
        </div>
      </section>

      <h2 className="b2-heading">{at("Что делать уже сейчас", "What to do now", "Қазір не істеу керек")}</h2>
      <div className="b2-actions">
        <Link className="panel b2-action" to="/course?level=B1">
          <MessagesSquare size={22} />
          <strong>{at("Пройти B1", "Finish B1", "B1 өту")}</strong>
          <span>{at("Пространство, рассказ, мнение", "Space, story, opinion", "Кеңістік, әңгіме")}</span>
          <ArrowRight size={18} />
        </Link>
        <Link className="panel b2-action" to="/understanding/phrases">
          <Ear size={22} />
          <strong>{at("Тренировать понимание", "Train understanding", "Түсінуді жаттықтыру")}</strong>
          <span>{at("Смотреть фразы и понимать смысл", "Watch phrases, get the meaning", "Фразаларды түсіну")}</span>
          <ArrowRight size={18} />
        </Link>
        <Link className="panel b2-action" to="/live-practice">
          <UsersRound size={22} />
          <strong>{at("Живая практика", "Live practice", "Тірі тәжірибе")}</strong>
          <span>{at("Зеркало с носителем и где найти собеседников", "Mirror and where to find signers", "Айна және серіктестер")}</span>
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}

export function CoursePage() {
  const [params, setParams] = useSearchParams();
  const placed = readPlacement();
  const placedLevel = placed && "level" in placed ? (placed.level === "B2" ? "B1" : placed.level) : "A1";
  const level = (LEVELS.find((l) => l.id === params.get("level"))?.id ?? placedLevel) as CefrLevel;
  const meta = LEVELS.find((l) => l.id === level)!;
  const units = level === "B2" ? [] : courseUnits(level);
  const progress = readProgress();
  const next = units.find((u) => !progress[u.id]?.done) ?? units[units.length - 1];
  const count = (l: CefrLevel) => (l === "B2" ? [0, 0] : [courseUnits(l).filter((u) => progress[u.id]?.done).length, courseUnits(l).length]);
  const doneCount = units.filter((u) => progress[u.id]?.done).length;
  const [sl, chooseSl] = useChooseSignLang();
  const kz = sl === "ksl";
  return (
    <div className="sign-workspace vocab course" data-level={level}>
      <PlacementPrompt hasHistory={Object.keys(progress).length > 0} />
      <section className="course-hero course-anim">
        <div className="course-hero-text">
          <span className="eyebrow">{at("КУРС ПО ШАГАМ", "STEP-BY-STEP COURSE", "ҚАДАМДЫҚ КУРС")} · {level} · {meta.name}</span>
          <h1>
            {kz
              ? at("Казахский жестовый язык с нуля", "Kazakh Sign Language from zero", "Нөлден бастап қазақ ым тілі")
              : at("Русский жестовый язык с нуля", "Russian Sign Language from zero", "Нөлден бастап орыс ым тілі")}
          </h1>
          <div className="course-sl-switch" role="radiogroup" aria-label={at("Какой жестовый язык учим", "Which sign language", "Қай ым тілін үйренеміз")}>
            <button role="radio" aria-checked={!kz} onClick={() => chooseSl("rsl")}>
              <strong>🇷🇺 РЖЯ</strong>
              <span>{at("Русский жестовый · уроки на русском", "Russian SL · lessons in Russian", "Орыс ым тілі · сабақтар орысша")}</span>
            </button>
            <button role="radio" aria-checked={kz} onClick={() => chooseSl("ksl")}>
              <strong>🇰🇿 ҚЖЯ</strong>
              <span>{at("Казахский жестовый · уроки на казахском", "Kazakh SL · lessons in Kazakh", "Қазақ ым тілі · сабақтар қазақша")}</span>
            </button>
          </div>
          <p>
            {at(
              "Учитесь по шагам: смотрите жесты носителей, проверяйте себя, показывайте в камеру и закрепляйте в диалогах.",
              "Learn step by step: watch native signers, check yourself, sign to the camera, practise in dialogues.",
              "Қадаммен үйреніңіз.",
            )}
            {kz &&
              " " +
                at(
                  "Уроки построены на видео носителей казахского жестового языка (словарь SURDO.KZ), алфавит — 42 буквы.",
                  "Lessons use videos of Kazakh signers (SURDO.KZ dictionary); the alphabet has 42 letters.",
                  "Сабақтар қазақ ым тілі иелерінің бейнелеріне негізделген (SURDO.KZ сөздігі), әліпби — 42 әріп.",
                )}
          </p>
          <div className="course-hero-actions">
            {next && (
              <Link className="button primary course-cta" style={{ background: "var(--lvl)", borderColor: "transparent", color: "#fff" }} to={`/course/${next.id}`}>
                <Play size={18} /> {doneCount ? at("Продолжить", "Continue", "Жалғастыру") : at("Начать", "Start", "Бастау")}: {next.title}
              </Link>
            )}
            {level !== "B2" && <ProgressRing done={doneCount} total={units.length} />}
            {level !== "B2" && (
              <Link className="text-link" to={`/learn-test?cefr=${level}`}>
                <Award size={16} /> {at(`Итоговый тест ${level}`, `${level} test`, `${level} тесті`)}
              </Link>
            )}
          </div>
        </div>
        <div className="course-hero-art" aria-hidden="true">
          <div className="course-blob" />
          <img src="/images/landing-v2/mentor-wave.webp" alt="" />
          <span className="course-bubble">{at("Привет! 👋", "Hi! 👋", "Сәлем! 👋")}</span>
        </div>
      </section>

      {kz ? (
        <>
          <section className="course-before">
            <h2>{at("Перед стартом", "Before you start", "Бастамас бұрын")}</h2>
            <div className="course-before-grid">
              <Link className="panel course-before-card" to="/kazakh">
                <span className="course-before-icon"><Hand size={20} /></span>
                <span><strong>{at("Казахский дактиль", "Kazakh fingerspelling", "Қазақ дактилі")}</strong><span>{at("42 буквы, проверка камерой", "42 letters, camera check", "42 әріп, камерамен тексеру")}</span></span>
              </Link>
              <Link className="panel course-before-card" to="/culture">
                <span className="course-before-icon"><Users size={20} /></span>
                <span><strong>{at("Культура и этикет глухих", "Deaf culture", "Керең мәдениеті")}</strong><span>{at("Как общаться уважительно", "Respectful communication", "Әдеп")}</span></span>
              </Link>
            </div>
          </section>
          <h2 className="course-section-title">{at("Уроки казахского жестового языка", "Kazakh Sign Language lessons", "Қазақ ым тілі сабақтары")}</h2>
          <KazakhCourseList />
        </>
      ) : (
      <>
      <div className="course-levels" role="tablist" aria-label={at("Уровень", "Level", "Деңгей")}>
        {LEVELS.map((l, i) => {
          const [d, t] = count(l.id);
          const Icon = l.icon;
          return (
            <button key={l.id} role="tab" data-level={l.id} aria-selected={l.id === level} onClick={() => setParams({ level: l.id })} className="course-anim" style={{ "--i": i } as React.CSSProperties}>
              <span className="course-level-icon"><Icon size={20} /></span>
              <span className="course-level-text">
                <strong>{l.title} <em>{l.name}</em></strong>
                <span>{l.desc}</span>
              </span>
              {t > 0 && <span className={`course-level-count${d === t ? " full" : ""}`}>{d === t ? <Check size={14} /> : `${d}/${t}`}</span>}
            </button>
          );
        })}
      </div>

      {level === "B2" ? (
        <B2Roadmap count={count} onPick={(l) => setParams({ level: l })} />
      ) : (
        <>
          {level === "A1" && (
            <section className="course-before">
              <h2>{at("Перед стартом", "Before you start", "Бастамас бұрын")}</h2>
              <div className="course-before-grid">
                {[
                  { to: "/culture", icon: Users, t: at("Культура и этикет глухих", "Deaf culture", "Керең мәдениеті"), d: at("Как привлечь внимание и общаться уважительно", "Etiquette and respectful words", "Әдеп") },
                  kz
                    ? { to: "/kazakh", icon: Hand, t: at("Казахский дактиль", "Kazakh fingerspelling", "Қазақ дактилі"), d: at("42 буквы: + Ә Ғ Қ Ң Ө Ұ Ү Һ І, проверка камерой", "42 letters incl. Ә Ғ Қ Ң Ө Ұ Ү Һ І, camera check", "42 әріп: Ә Ғ Қ Ң Ө Ұ Ү Һ І, камерамен тексеру") }
                    : { to: "/practice", icon: Hand, t: at("Азбука (дактиль)", "Alphabet", "Әліпби"), d: at("33 буквы — чтобы показать своё имя", "33 letters for your name", "33 әріп") },
                  { to: "/fingerspell", icon: Type, t: at("Чтение дактиля", "Reading fingerspelling", "Дактильді оқу"), d: at("Понимать имена по буквам", "Understand spelled names", "Есімдерді түсіну") },
                ].map((c, i) => (
                  <Link key={c.to} className="panel course-before-card course-anim" to={c.to} style={{ "--i": i + 4 } as React.CSSProperties}>
                    <span className="course-before-icon"><c.icon size={20} /></span>
                    <span><strong>{c.t}</strong><span>{c.d}</span></span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <h2 className="course-section-title">{at("Уроки", "Lessons", "Сабақтар")} {level}</h2>
          <div className="course-units">
            {units.map((u, i) => {
              const done = progress[u.id]?.done;
              const current = !done && u.id === next?.id;
              return (
                <Link key={u.id} className={`panel course-unit card-motion${done ? " done" : ""}${current ? " current" : ""} course-anim`} to={`/course/${u.id}`} style={{ "--i": i + 6 } as React.CSSProperties}>
                  <div className="course-unit-thumb">
                    <UnitArt id={u.id} index={i} />
                    <span className="course-unit-num">{done ? <CheckCircle2 size={20} /> : i + 1}</span>
                    {current && <span className="course-unit-now">{at("Сейчас", "Now", "Қазір")}</span>}
                  </div>
                  <div className="course-unit-body">
                    <strong>{u.title}</strong>
                    <span>{u.goal}</span>
                    <div className="course-unit-words">
                      {u.words.slice(0, 4).map((w) => <i key={w}>{wordText(w, sl)}</i>)}
                      {u.words.length > 4 && <i>+{u.words.length - 4}</i>}
                    </div>
                  </div>
                  <div className="course-unit-foot">
                    <span>{done ? at("Пройден", "Done", "Өтті") : current ? at("Продолжить", "Continue", "Жалғастыру") : at("Открыть", "Open", "Ашу")}</span>
                    <ArrowRight size={16} />
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
      </>
      )}
      <p className="fs-credit">
        {at(
          kz
            ? "Жесты — видео носителей казахского жестового языка из словаря SURDO.KZ (МОН РК); курс не проверен сертифицированным переводчиком."
            : "Жесты — видео носителей РЖЯ (Slovo, Bukva · ai-forever). Порядок и правила — по учебной литературе; курс не проверен сертифицированным переводчиком.",
          "Signs are native-signer videos (Slovo, Bukva). Rules follow textbooks; not reviewed by a certified interpreter.",
          kz ? "Ымдар — SURDO.KZ сөздігіндегі қазақ ым тілі бейнелері." : "Ымдар — Slovo, Bukva бейнелері.",
        )}
      </p>
    </div>
  );
}

export function CourseUnitPage() {
  const { id } = useParams();
  const all = courseUnits("all");
  const unit = all.find((u) => u.id === Number(id)) ?? all[0];
  const level = levelOf(unit.id);
  const units = courseUnits(level);
  const { data, error } = useActivityCatalog();
  const [step, setStep] = useState(() => Math.min(readProgress()[unit.id]?.step ?? 0, 5));
  const go = (s: number) => {
    setStep(s);
    save(unit.id, { step: s });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const entries = useMemo(() => {
    const byLabel = new Map((data?.entries ?? []).map((e) => [e.label, e]));
    return unit.words.map((w) => byLabel.get(w)).filter((e): e is DictionaryEntry => !!e);
  }, [data, unit]);
  if (error) return <p className="translate-status error">{error}</p>;
  const next = units[units.indexOf(unit) + 1];
  return (
    <div className="sign-workspace vocab fingerspell course">
      <Link className="text-link back-link" to={`/course?level=${level}`}>
        <ArrowLeft size={16} /> {at("Все уроки", "All lessons", "Барлық сабақ")} {level}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{level} · {at("УРОК", "LESSON", "САБАҚ")} {units.indexOf(unit) + 1} / {units.length}</span>
          <h1>{unit.title}</h1>
          <p>{unit.goal}</p>
        </div>
      </div>
      <ol className="course-steps">
        {STEPS().map((s, k) => [k === 3 && unit.speak ? at("Расскажи сам", "Tell it yourself", "Өзің айт") : s, k] as const).map(([s, k]) => (
          <li key={k}>
            <button aria-current={k === step ? "step" : undefined} className={k < step ? "past" : ""} onClick={() => go(k)}>
              <span>{k < step ? <Check size={14} /> : k + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      {!data ? (
        <p>…</p>
      ) : step === 0 ? (
        <WordsStep entries={entries} unit={unit} onNext={() => go(1)} />
      ) : step === 1 ? (
        <QuizStep entries={entries} all={data.entries} unit={unit} onNext={() => go(2)} />
      ) : step === 2 ? (
        <PhrasesStep unit={unit} onNext={() => go(3)} />
      ) : step === 3 ? (
        unit.speak ? <SpeakStep task={unit.speak} onNext={() => go(4)} /> : <CameraStep entries={entries} onNext={() => go(4)} />
      ) : step === 4 ? (
        <PracticeStep unit={unit} onNext={() => { save(unit.id, { done: true }); go(5); }} />
      ) : (
        <section className="panel fs-done">
          <CheckCircle2 size={40} />
          <h2>{at("Урок пройден!", "Lesson complete!", "Сабақ аяқталды!")}</h2>
          <p>{unit.tip}</p>
          <p className="fs-tip">
            {at(
              "Повторите жесты через день-два в «Тренажёре слов» — так они запомнятся надолго.",
              "Review these signs in a day or two in the word trainer.",
              "Бір-екі күннен кейін қайталаңыз.",
            )}
          </p>
          <div className="fs-actions">
            {next ? (
              <Link className="button primary" to={`/course/${next.id}`} onClick={() => save(unit.id, { done: true })}>
                {at("Следующий урок", "Next lesson", "Келесі сабақ")}: {next.title} <ArrowRight size={16} />
              </Link>
            ) : (
              <Link className="button primary" to={`/learn-test?cefr=${level}`}>{at(`Итоговый тест ${level}`, `${level} test`, `${level} тесті`)}</Link>
            )}
            <Link className="button secondary" to="/vocab">{at("Повторение", "Review", "Қайталау")}</Link>
          </div>
        </section>
      )}
    </div>
  );
}

function WordsStep({ entries, unit, onNext }: { entries: DictionaryEntry[]; unit: CourseUnit; onNext: () => void }) {
  const [sl] = useSignLang();
  const [sel, setSel] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const e = entries[sel];
  return (
    <div className="fs-round">
      <section className="panel fs-player">
        {e && <video key={e.id} className="test-video" src={e.displayVideo || e.video} autoPlay loop muted playsInline controls />}
        <strong className="course-word">{e && wordText(e.label, sl)}</strong>
        {e && sl === "ksl" && <span className="course-word-ru">{e.label.replace(/[!?]$/, "")}</span>}
      </section>
      <section className="panel fs-answer">
        <h2>{at("Посмотрите каждый жест и повторите его", "Watch each sign and repeat it", "Әр ымды қарап, қайталаңыз")}</h2>
        <div className="vocab-chips course-chips">
          {entries.map((w, k) => (
            <button key={w.id} aria-pressed={k === sel} className={seen.has(k) ? "seen" : ""} onClick={() => { setSel(k); setSeen((s) => new Set(s).add(k)); }}>
              {wordText(w.label, sl)}
            </button>
          ))}
        </div>
        <p className="fs-tip">{unit.tip}</p>
        <p className="fs-tip">{at(`Просмотрено: ${seen.size} из ${entries.length}`, `Viewed: ${seen.size} of ${entries.length}`, `${seen.size} / ${entries.length}`)}</p>
        <button className="button primary" onClick={onNext}>
          {at("Проверить себя", "Check yourself", "Өзіңді тексер")} <ArrowRight size={16} />
        </button>
      </section>
    </div>
  );
}

function QuizStep({ entries, all, unit, onNext }: { entries: DictionaryEntry[]; all: DictionaryEntry[]; unit: CourseUnit; onNext: () => void }) {
  const [sl] = useSignLang();
  const items = useMemo(() => shuffle(entries).slice(0, 6), [entries]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const t = items[i];
  const options = useMemo(() => {
    if (!t) return [];
    const others = shuffle(entries.filter((e) => e.id !== t.id)).slice(0, 3);
    while (others.length < 3) others.push(shuffle(all.filter((e) => e.id !== t.id && !others.includes(e)))[0]);
    return shuffle([t, ...others]);
  }, [t, entries, all]);
  useEffect(() => {
    if (!t) save(unit.id, { quiz: score });
  }, [t]);
  if (!t) {
    return (
      <section className="panel fs-done">
        <h2>{at("Проверка", "Check", "Тексеру")}: {score} / {items.length}</h2>
        <p>{score >= items.length - 1 ? at("Отлично — жесты узнаются!", "Great!", "Тамаша!") : at("Можно вернуться к шагу «Новые жесты» и посмотреть ещё раз.", "You can go back to the new signs.", "Қайта қарауға болады.")}</p>
        <button className="button primary" onClick={onNext}>{at("К фразам", "To phrases", "Сөйлемдерге")} <ArrowRight size={16} /></button>
      </section>
    );
  }
  return (
    <div className="fs-round">
      <section className="panel fs-player">
        <video key={t.id + i} className="test-video" src={t.displayVideo || t.video} autoPlay loop muted playsInline controls />
      </section>
      <section className="panel fs-answer">
        <span className="eyebrow">{i + 1} / {items.length}</span>
        <h2>{at("Что это за жест?", "Which sign is it?", "Бұл қандай ым?")}</h2>
        <div className="vocab-choices">
          {options.map((o) => (
            <button key={o.id} className={!picked ? "" : o.id === t.id ? "right" : o.id === picked ? "wrong" : ""} onClick={() => { if (picked) return; setPicked(o.id); if (o.id === t.id) setScore((s) => s + 1); }}>
              {wordText(o.label, sl)}
            </button>
          ))}
        </div>
        {picked && (
          <>
            <p className={`vocab-feedback ${picked === t.id ? "ok" : "no"}`}>{picked === t.id ? <Check size={18} /> : <X size={18} />} {wordText(t.label, sl)}</p>
            <button className="button primary" onClick={() => { setPicked(null); setI((n) => n + 1); }}>{at("Дальше", "Next", "Келесі")} <ArrowRight size={16} /></button>
          </>
        )}
      </section>
    </div>
  );
}

function PhrasesStep({ unit, onNext }: { unit: CourseUnit; onNext: () => void }) {
  const [sl] = useSignLang();
  const [k, setK] = useState(0);
  const p = unit.phrases[k];
  return (
    <div className="fs-round">
      <section className="panel fs-player">
        <SignChain key={p.ru} signs={p.signs} compact />
      </section>
      <section className="panel fs-answer">
        <h2>{at("Фразы урока", "Lesson phrases", "Сабақ сөйлемдері")}</h2>
        <div className="vocab-chips">
          {unit.phrases.map((x, j) => (
            <button key={x.ru} aria-pressed={j === k} onClick={() => setK(j)}>{phraseText(x.ru, sl)}</button>
          ))}
        </div>
        <p className="grammar-example">
          <strong>{phraseText(p.ru, sl)}</strong>
          {sl === "ksl" && <small className="course-word-ru">{p.ru}</small>}
          <span>{p.signs.map((s) => wordText(s, sl).toUpperCase()).join(" + ")}</span>
          {p.tip && <em>{tipText(p.tip, sl)}</em>}
        </p>
        <p className="fs-tip">{at("Повторите фразу вслед за видео — сначала медленно (0.5×), потом в обычном темпе.", "Repeat the phrase after the video, slowly first.", "Бейнеден кейін қайталаңыз.")}</p>
        <button className="button primary" onClick={onNext}>{at("Показать самому", "Sign it yourself", "Өзің көрсет")} <ArrowRight size={16} /></button>
      </section>
    </div>
  );
}

function CameraStep({ entries, onNext }: { entries: DictionaryEntry[]; onNext: () => void }) {
  const [sl] = useSignLang();
  const [sel, setSel] = useState(0);
  const e = entries[sel];
  return (
    <div className="course-camera">
      <section className="panel fs-answer">
        <h2>{at("Покажите жест в камеру — ИИ проверит", "Sign to the camera — AI checks it", "Камераға көрсетіңіз")}</h2>
        <p className="fs-tip">{at("Нужен Chrome и разрешение на камеру. Видео не покидает компьютер. Шаг можно пропустить.", "Chrome and camera permission needed. Video stays on your device. You may skip this step.", "Chrome және камера рұқсаты керек.")}</p>
        <div className="vocab-chips">
          {entries.map((w, k) => (
            <button key={w.id} aria-pressed={k === sel} onClick={() => setSel(k)}>{wordText(w.label, sl)}</button>
          ))}
        </div>
        <button className="button primary" onClick={onNext}>{at("Дальше", "Next", "Келесі")} <ArrowRight size={16} /></button>
      </section>
      {e && <WordPracticeCamera key={e.id} target={e.label} choices={entries.map((w) => w.label)} />}
    </div>
  );
}

function PracticeStep({ unit, onNext }: { unit: CourseUnit; onNext: () => void }) {
  return (
    <section className="panel fs-answer">
      <h2>{at("Закрепите в грамматике и диалоге", "Practise in grammar and a dialogue", "Грамматика мен диалогта бекітіңіз")}</h2>
      <div className="course-before-grid">
        {unit.grammar && (
          <Link className="panel" to={`/grammar?track=rsl&lesson=${unit.grammar}`} target="_blank">
            <strong>{at("Урок грамматики", "Grammar lesson", "Грамматика сабағы")}</strong>
            <span>{at("Правило и упражнения по теме", "Rule and exercises", "Ереже мен жаттығулар")}</span>
          </Link>
        )}
        {unit.dialogue && (
          <Link className="panel" to={`/dialogues?scenario=${unit.dialogue}`} target="_blank">
            <strong>{at("Диалог", "Dialogue", "Диалог")}</strong>
            <span>{at("Ответьте собеседнику в ситуации", "Reply in a situation", "Жағдаятта жауап беріңіз")}</span>
          </Link>
        )}
        {unit.extra && (
          <Link className="panel" to={unit.extra.to} target="_blank">
            <strong>{at("Дополнительно", "Extra", "Қосымша")}</strong>
            <span>{unit.extra.label}</span>
          </Link>
        )}
      </div>
      <p className="fs-tip">{at("Откроются в новой вкладке — вернитесь сюда, чтобы завершить урок.", "They open in a new tab — come back to finish.", "Жаңа қойындыда ашылады.")}</p>
      <button className="button primary" onClick={onNext}>
        <Circle size={14} /> {at("Завершить урок", "Finish the lesson", "Сабақты аяқтау")}
      </button>
    </section>
  );
}

function SpeakStep({ task, onNext }: { task: string; onNext: () => void }) {
  return (
    <section className="panel fs-answer">
      <h2>{at("Расскажите сами", "Tell it yourself", "Өзіңіз айтыңыз")}</h2>
      <p className="grammar-example"><strong>{task}</strong></p>
      <ol className="params-list">
        <li>{at("Продумайте 3–5 фраз и нужные жесты (найдите их в словаре).", "Plan 3–5 phrases and look up the signs.", "3–5 сөйлем ойлаңыз.")}</li>
        <li>{at("Запишите себя в «Зеркале» и пересмотрите: время в начале? пространство? мимика?", "Record yourself in the Mirror and review.", "Айнада жазыңыз.")}</li>
        <li>{at("Сохраните запись у себя и через неделю сравните — так виден прогресс.", "Keep the recording and compare in a week.", "Бір аптадан кейін салыстырыңыз.")}</li>
      </ol>
      <div className="fs-actions">
        <Link className="button secondary" to="/live-practice" target="_blank">{at("Открыть «Зеркало»", "Open the Mirror", "Айнаны ашу")}</Link>
        <button className="button primary" onClick={onNext}>{at("Дальше", "Next", "Келесі")} <ArrowRight size={16} /></button>
      </div>
      <p className="fs-tip">{at("Это задание без автоматической проверки: связный рассказ пока может оценить только человек — носитель или преподаватель.", "No automatic check: only a person can judge a story.", "Автоматты тексеру жоқ.")}</p>
    </section>
  );
}
