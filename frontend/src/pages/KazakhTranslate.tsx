import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Hand, MessageCircle, Pause, Play, RotateCcw, Type } from "lucide-react";
import { at } from "../i18n/automation";
import { useLanguage } from "../i18n";
import { SignActionCards } from "../components/SignActionCards";
import { KazakhDictionary, KslVideo, ruOf, useKslCatalog, type KslEntry } from "./KazakhCourse";
import { KslClip, useTeacherLessons, type Phrase, type TeacherLesson } from "./KazakhTeacher";
import { SURDO_LETTER } from "../sign/kslLetters";
import "./sign-workspace.css";
import "./sign-dictionary.css";
import "./course.css";

/** Text → Kazakh signs (ҚЖЯ mode of /text-to-sign). Words are looked up in the
 * SURDO.KZ dictionary (Kazakh label, a Kazakh word with an ending, or the
 * Russian meaning); unknown words are fingerspelled with Kazakh letters.
 * Ready phrases are the «Оян, Qazaqstan» clips. Signs are shown word by word,
 * Kazakh SL grammar is not translated. */
type Step =
  | { kind: "sign"; entry: KslEntry; word: string }
  | { kind: "letter"; letter: string; word: string }
  | { kind: "phrase"; phrase: Phrase }
  /** A word from the «Саусақтар сөйлейді» teacher lessons (segment of a lesson video). */
  | { kind: "clip"; youtube: string; start: number; end: number; label: string; ru: string; word: string };
type Tab = "text" | "phrases" | "dictionary" | "grammar";

const norm = (s: string) =>
  s.normalize("NFKC").toLocaleLowerCase("kk").replace(/ё/g, "е").replace(/[!?.,:;«»"“”()—–-]/g, " ").replace(/\s+/g, " ").trim();

/** «Ү» has no SURDO.KZ clip: the «Саусақтар сөйлейді» letter lesson shows it (from 9 s). */
const LETTER_FALLBACK: Record<string, [string, number]> = { Ү: ["wtKosfU8HkY", 9] };

function planText(text: string, entries: KslEntry[], phrases: Phrase[], lessons: TeacherLesson[]): Step[] {
  const whole = norm(text);
  const phrase = phrases.find((p) => norm(p.kk) === whole);
  if (phrase) return [{ kind: "phrase", phrase }];
  const byLabel = new Map<string, KslEntry>();
  const byRu = new Map<string, KslEntry>();
  for (const e of entries) {
    const k = norm(e.label);
    if (!byLabel.has(k)) byLabel.set(k, e);
    const ru = ruOf(e.label);
    if (ru && !byRu.has(norm(ru))) byRu.set(norm(ru), e);
  }
  const clips = new Map<string, Step>();
  for (const l of lessons)
    for (const w of l.words) {
      const k = norm(w.kk.replace(/\(.*?\)/g, ""));
      if (k && !byLabel.has(k) && !clips.has(k)) clips.set(k, { kind: "clip", youtube: l.youtube, start: w.start, end: w.end, label: w.kk, ru: w.ru, word: k });
    }
  const lookup = (key: string, word: string): Step | null => {
    const e = byLabel.get(key) ?? byRu.get(key);
    if (e) return { kind: "sign", entry: e, word };
    const c = clips.get(key);
    return c ? { ...c, word } as Step : null;
  };
  const stems = [...byLabel.keys(), ...clips.keys()].filter((k) => !k.includes(" ") && k.length >= 3).sort((a, b) => b.length - a.length);
  const tokens = whole.split(" ").filter(Boolean);
  const steps: Step[] = [];
  for (let i = 0; i < tokens.length; ) {
    let hit = false;
    for (let n = Math.min(3, tokens.length - i); n >= 1 && !hit; n--) {
      const key = tokens.slice(i, i + n).join(" ");
      const hitStep = lookup(key, key);
      if (hitStep) {
        steps.push(hitStep);
        i += n;
        hit = true;
      }
    }
    if (hit) continue;
    const t = tokens[i];
    // Kazakh endings: «мектепке» → «мектеп», «досым» → «дос».
    const stem = stems.find((s) => t.startsWith(s) && t.length - s.length <= 5);
    if (stem) steps.push(lookup(stem, t)!);
    else
      for (const ch of t.toLocaleUpperCase("kk"))
        if (SURDO_LETTER[ch] || LETTER_FALLBACK[ch]) steps.push({ kind: "letter", letter: ch, word: t });
    i += 1;
  }
  return steps;
}

const letterId = (l: string) => SURDO_LETTER[l] ?? LETTER_FALLBACK[l]?.[0];
const thumb = (s: Step) =>
  `https://i.ytimg.com/vi/${s.kind === "sign" ? s.entry.youtube : s.kind === "letter" ? letterId(s.letter) : s.kind === "clip" ? s.youtube : s.phrase.youtube}/mqdefault.jpg`;
const title = (s: Step) =>
  (s.kind === "sign" ? s.entry.label : s.kind === "letter" ? s.letter : s.kind === "clip" ? s.label : s.phrase.kk).replace(/[!?]$/, "");

export function KazakhTranslate({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { data } = useKslCatalog();
  const teacher = useTeacherLessons().data;
  const { language } = useLanguage();
  const showRu = language !== "kk";
  const view = tab === "dictionary" ? "dictionary" : tab === "phrases" ? "phrases" : "text";
  const [text, setText] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [at_, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const phrases = teacher?.phrases.items ?? [];
  const cur = steps[at_];
  useEffect(() => {
    if (!playing || !cur || at_ >= steps.length - 1) {
      if (playing && at_ >= steps.length - 1) {
        const t = setTimeout(() => setPlaying(false), 4000);
        return () => clearTimeout(t);
      }
      return;
    }
    const t = setTimeout(() => setAt((n) => n + 1), cur.kind === "letter" ? 3000 : 4200);
    return () => clearTimeout(t);
  }, [playing, at_, steps.length, cur]);
  const show = (next: Step[]) => {
    setSteps(next);
    setAt(0);
    setPlaying(next.length > 1);
  };
  const translate = (v = text) => data && show(planText(v, data.entries, phrases, teacher?.teacher.lessons ?? []));
  const spelled = useMemo(() => [...new Set(steps.filter((s) => s.kind === "letter").map((s) => s.word))], [steps]);
  const examples = ["Сәлеметсіз бе!", "Атыңыз кім?", "Мектеп қайда?", "Әкем мектепте", "Рахмет!"];

  const player = (
    <div className="sign-dictionary-result text-sign-player">
      {cur ? (
        <section className="panel ksl-tr-player">
          {cur.kind === "phrase" ? (
            <KslClip key={at_} id={cur.phrase.youtube} start={cur.phrase.start} end={cur.phrase.end} />
          ) : cur.kind === "clip" ? (
            <KslClip key={at_} id={cur.youtube} start={cur.start} end={cur.end} />
          ) : cur.kind === "letter" && !SURDO_LETTER[cur.letter] ? (
            <KslClip key={at_} id={LETTER_FALLBACK[cur.letter][0]} start={LETTER_FALLBACK[cur.letter][1]} />
          ) : (
            <KslVideo key={`${at_}-${title(cur)}`} id={cur.kind === "sign" ? cur.entry.youtube : SURDO_LETTER[(cur as { letter: string }).letter]} />
          )}
          <div className="ksl-tr-now">
            <strong>{title(cur)}</strong>
            {cur.kind === "letter" && <span>{at(`буква слова «${cur.word}»`, `letter of «${cur.word}»`, `«${cur.word}» сөзінің әрпі`)}</span>}
            {cur.kind === "sign" && showRu && ruOf(cur.entry.label) && <span>{ruOf(cur.entry.label)}</span>}
            {cur.kind === "phrase" && showRu && <span>{cur.phrase.ru}</span>}
            {cur.kind === "clip" && showRu && cur.ru && <span>{cur.ru}</span>}
          </div>
          {steps.length > 1 && (
            <div className="ksl-dict-nav">
              <button className="button secondary" disabled={at_ === 0} onClick={() => { setPlaying(false); setAt(at_ - 1); }} aria-label={at("Назад", "Back", "Артқа")}>
                <ArrowLeft size={16} />
              </button>
              <span>{at_ + 1} / {steps.length}</span>
              <button className="button secondary" onClick={() => (at_ >= steps.length - 1 ? (setAt(0), setPlaying(true)) : setPlaying(!playing))}>
                {playing ? <Pause size={16} /> : at_ >= steps.length - 1 ? <RotateCcw size={16} /> : <Play size={16} />}
                {playing ? at("Пауза", "Pause", "Кідірту") : at_ >= steps.length - 1 ? at("Сначала", "Restart", "Басынан") : at("Авто", "Auto", "Авто")}
              </button>
              <button className="button primary" disabled={at_ >= steps.length - 1} onClick={() => { setPlaying(false); setAt(at_ + 1); }}>
                {at("Дальше", "Next", "Келесі")} <ArrowRight size={16} />
              </button>
            </div>
          )}
          {steps.length > 1 && (
            <ol className="ksl-tr-strip">
              {steps.map((s, n) => (
                <li key={n}>
                  <button type="button" aria-current={n === at_ ? "true" : undefined} onClick={() => { setPlaying(false); setAt(n); }}>
                    <img src={thumb(s)} alt="" loading="lazy" />
                    <span>{title(s)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {spelled.length > 0 && (
            <p className="fs-tip">
              {at("Нет в словаре, показано по буквам:", "Not in the dictionary, fingerspelled:", "Сөздікте жоқ, әріппен көрсетілді:")} {spelled.join(", ")}
            </p>
          )}
        </section>
      ) : (
        <div className="tts-empty">
          <span className="tts-empty-blob" />
          <img src="/images/landing-v2/mentor-wave.webp" alt="" />
          <strong>{at("Здесь появятся жесты ҚЖЯ", "Kazakh signs appear here", "ҚЖЯ ымдары осында шығады")}</strong>
          <p>
            {view === "phrases"
              ? at("Выберите фразу слева.", "Choose a phrase on the left.", "Сол жақтан сөйлем таңдаңыз.")
              : at("Напишите фразу по-казахски или по-русски — покажем жесты носителей SURDO.KZ по порядку.", "Type a phrase in Kazakh or Russian — signs from SURDO.KZ play in order.", "Қазақша не орысша жазыңыз — SURDO.KZ ымдары ретімен көрсетіледі.")}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className={`sign-workspace sign-dictionary text-sign-page text-sign-page--${view === "dictionary" ? "dictionary" : "text"} ksl-translate`}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ҚЖЯ</span>
          <h1>{at("Текст → жесты ҚЖЯ", "Text → Kazakh signs", "Мәтін → ҚЖЯ ымдары")}</h1>
          <p>
            {at(
              "Напишите фразу или выберите готовую — покажем жесты казахских носителей по порядку.",
              "Type or pick a phrase — Kazakh signers show it sign by sign.",
              "Сөйлем жазыңыз не дайынын таңдаңыз — қазақ ым иелері ретімен көрсетеді.",
            )}
          </p>
        </div>
      </div>
      <SignActionCards
        label={at("Что хотите сделать?", "What would you like to do?", "Не істегіңіз келеді?")}
        value={view}
        onChange={(next) => {
          if (next === "text" || next === "phrases" || next === "dictionary") {
            setTab(next);
            setSteps([]);
            setPlaying(false);
          }
        }}
        items={[
          { id: "text", title: at("Написать текст", "Write text", "Мәтін жазу"), description: at("Казахский или русский → жесты ҚЖЯ", "Kazakh or Russian → Kazakh signs", "Қазақша не орысша → ҚЖЯ ымдары"), tag: at("Ваш вариант", "Your choice", "Өз нұсқаңыз") },
          { id: "phrases", title: at("Готовые фразы", "Ready phrases", "Дайын сөйлемдер"), description: at("Показывают носители «Оян, Qazaqstan»", "Shown by «Оян, Qazaqstan» signers", "«Оян, Qazaqstan» ым иелері көрсетеді"), tag: at(`${phrases.length || 14} фраз`, `${phrases.length || 14} phrases`, `${phrases.length || 14} сөйлем`) },
          { id: "dictionary", title: at("Найти жест", "Find a sign", "Ым табу"), description: at("751 жест по темам", "751 signs by topic", "Тақырып бойынша 751 ым"), tag: "SURDO.KZ" },
        ]}
      />
      <div className="sign-workspace-meta">
        <span>{at("42 буквы · 751 жест SURDO.KZ", "42 letters · 751 SURDO.KZ signs", "42 әріп · SURDO.KZ 751 ым")}</span>
      </div>
      {view === "dictionary" && <KazakhDictionary />}
      {view === "text" && (
        <>
          <section className="panel tts-card">
            <div className="tts-card-head">
              <span className="tts-pill"><Type size={14} /> {at("Казахский / русский", "Kazakh / Russian", "Қазақша / орысша")}</span>
              <ArrowRight size={16} />
              <span className="tts-pill to"><Hand size={14} /> {at("Жесты ҚЖЯ", "Kazakh signs", "ҚЖЯ ымдары")}</span>
              <span className="tts-count">{text.length}/300</span>
            </div>
            <textarea
              className="tts-input"
              value={text}
              maxLength={300}
              rows={4}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) translate();
              }}
              placeholder={at("Например: Сәлеметсіз бе! Менің атым Айгүл", "For example: Сәлеметсіз бе! Менің атым Айгүл", "Мысалы: Сәлеметсіз бе! Менің атым Айгүл")}
              aria-label={at("Текст", "Text", "Мәтін")}
            />
            <div className="tts-examples tts-examples-in">
              <span>{at("Попробуйте", "Try", "Байқап көріңіз")}:</span>
              {examples.map((ex) => (
                <button key={ex} onClick={() => { setText(ex); translate(ex); }} disabled={!data}>{ex}</button>
              ))}
            </div>
            <div className="tts-toolbar">
              <button className="button primary tts-go" disabled={!data || !text.trim()} onClick={() => translate()}>
                {at("Показать жестами", "Show in signs", "Ыммен көрсету")}
                <ArrowRight size={18} />
              </button>
            </div>
          </section>
          <p className="tts-extras tts-note">
            {at(
              "Жесты показываются по словам. Грамматику ҚЖЯ (порядок слов, мимику) автоматически не переводим.",
              "Signs are shown word by word; Kazakh SL grammar is not translated automatically.",
              "Ымдар сөзбе-сөз көрсетіледі; ҚЖЯ грамматикасы автоматты аударылмайды.",
            )}
          </p>
          {player}
        </>
      )}
      {view === "phrases" && (
        <>
          <section className="panel tts-card ksl-tr-phrases">
            <div className="tts-card-head">
              <span className="tts-pill"><MessageCircle size={14} /> {at("Готовые фразы", "Ready phrases", "Дайын сөйлемдер")}</span>
            </div>
            <div className="ksl-tr-phrase-list">
              {phrases.map((p) => (
                <button
                  key={`${p.youtube}-${p.start}`}
                  type="button"
                  aria-pressed={cur?.kind === "phrase" && cur.phrase === p}
                  onClick={() => show([{ kind: "phrase", phrase: p }])}
                >
                  <span className="ksl-tr-play"><Play size={14} /></span>
                  <span>
                    <strong>{p.kk}</strong>
                    {showRu && <small>{p.ru}</small>}
                  </span>
                </button>
              ))}
            </div>
          </section>
          {player}
        </>
      )}
    </div>
  );
}
