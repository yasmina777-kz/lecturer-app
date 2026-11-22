import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { at } from "../i18n/automation";
import { shuffle } from "../sign/activities";
import { useActivityCatalog } from "../sign/useActivities";
import type { DictionaryEntry } from "../sign/dictionary";
import "./sign-workspace.css";
import "./sign-vocabulary.css";
import "./fingerspell.css";
import "./course.css";

/** Numbers, time and money on native-signer videos. Cardinals and clock times are
 * typed as digits (active recall); days, months and money words are chosen. */
const NUM: Record<string, string> = {
  ноль: "0", один: "1", два: "2", три: "3", четыре: "4", пять: "5", шесть: "6", семь: "7", восемь: "8", девять: "9", десять: "10",
  одиннадцать: "11", двенадцать: "12", тринадцать: "13", четырнадцать: "14", пятнадцать: "15", шестнадцать: "16", семнадцать: "17",
  восемнадцать: "18", девятнадцать: "19", двадцать: "20", тридцать: "30", сорок: "40", пятьдесят: "50", шестьдесят: "60",
  семьдесят: "70", восемьдесят: "80", девяносто: "90", сто: "100", двести: "200", триста: "300", четыреста: "400", пятьсот: "500",
  семьсот: "700", восемьсот: "800", девятьсот: "900", тысяча: "1000", "две тысячи": "2000", "три тысячи": "3000", "пять тысяч": "5000", миллион: "1000000",
};
const TIME: Record<string, string> = { "2 часа": "2:00", "6 часов": "6:00", "7:45": "7:45", "в восемь пятнадцать": "8:15", "время 11 часов": "11:00" };
type Set = { id: string; title: string; hint: string; typed: boolean; labels: string[]; answer: (l: string) => string };
const SETS = (): Set[] => [
  { id: "n20", title: at("Числа 0–20", "Numbers 0–20", "Сандар 0–20"), hint: at("Введите число цифрами", "Type the number", "Санды жазыңыз"), typed: true,
    labels: Object.keys(NUM).filter((k) => +NUM[k] <= 20), answer: (l) => NUM[l] },
  { id: "big", title: at("Десятки, сотни, тысячи", "Tens, hundreds, thousands", "Ондықтар, жүздіктер"), hint: at("Введите число цифрами", "Type the number", "Санды жазыңыз"), typed: true,
    labels: Object.keys(NUM).filter((k) => +NUM[k] > 20), answer: (l) => NUM[l] },
  { id: "time", title: at("Который час?", "What time is it?", "Сағат неше?"), hint: at("Введите время, например 7:45", "Type the time, e.g. 7:45", "Уақытты жазыңыз"), typed: true,
    labels: Object.keys(TIME), answer: (l) => TIME[l] },
  { id: "days", title: at("Дни, месяцы, времена года", "Days, months, seasons", "Күндер, айлар"), hint: at("Выберите значение", "Choose the meaning", "Мағынасын таңдаңыз"), typed: false,
    labels: ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье", "выходные", "август", "октябрь", "ноябрь", "декабрь", "зима", "весна", "лето", "осень"], answer: (l) => l },
  { id: "when", title: at("Когда? Время в речи", "When? Time words", "Қашан?"), hint: at("Выберите значение", "Choose the meaning", "Мағынасын таңдаңыз"), typed: false,
    labels: ["сегодня", "завтра", "вчера", "утро", "день", "вечер", "ночь", "час", "минута", "неделя", "месяц", "год", "скоро", "потом", "всегда", "никогда", "иногда", "рано", "поздно", "две недели"], answer: (l) => l },
  { id: "money", title: at("Деньги и покупки", "Money and shopping", "Ақша"), hint: at("Выберите значение", "Choose the meaning", "Мағынасын таңдаңыз"), typed: false,
    labels: ["деньги", "цена", "сколько", "Рубль", "дорогой", "дешёвый", "купить", "магазин"], answer: (l) => l },
];
// Clock times: "7:00" and "7" are the same answer; plain numbers compare exactly.
const digits = (s: string, clock = false) => {
  const d = s.replace(/[^\d]/g, "");
  return clock ? d.replace(/^(\d{1,2})00$/, "$1") : d.replace(/^0+(?=\d)/, "");
};

export function NumbersTrainerPage() {
  const { data } = useActivityCatalog();
  const [setId, setSetId] = useState<string | null>(null);
  const sets = SETS();
  const set = sets.find((s) => s.id === setId);
  const byLabel = useMemo(() => new Map((data?.entries ?? []).map((e) => [e.label, e])), [data]);
  return (
    <div className="sign-workspace vocab fingerspell course">
      <Link className="text-link back-link" to="/course">
        <ArrowLeft size={16} /> {at("Курс", "Course", "Курс")}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{at("ТРЕНАЖЁР", "TRAINER", "ЖАТТЫҒУ")}</span>
          <h1>{at("Числа, время, деньги", "Numbers, time, money", "Сандар, уақыт, ақша")}</h1>
          <p>{at("Возраст, цены, время встречи — без чисел не обойтись. Смотрите жест носителя и отвечайте.", "Age, prices, meeting times — watch the signer and answer.", "Жас, баға, уақыт.")}</p>
        </div>
      </div>
      {!set ? (
        <div className="fs-levels">
          {sets.map((s, i) => (
            <button key={s.id} className="panel fs-level" onClick={() => setSetId(s.id)} disabled={!data}>
              <span className="fs-num">0{i + 1}</span>
              <strong>{s.title}</strong>
              <span>{s.labels.filter((l) => byLabel.has(l)).length} {at("жестов", "signs", "ым")} · {s.typed ? at("ввод цифрами", "type digits", "цифрмен") : at("выбор ответа", "multiple choice", "таңдау")}</span>
            </button>
          ))}
        </div>
      ) : (
        <NumbersRound key={set.id} set={set} entries={set.labels.map((l) => byLabel.get(l)).filter((e): e is DictionaryEntry => !!e)} onExit={() => setSetId(null)} />
      )}
      <p className="fs-credit">
        {at(
          "Видео — носители РЖЯ (Slovo · ai-forever). Формы чисел у разных людей и в разных регионах могут немного отличаться.",
          "Videos: native signers (Slovo). Number forms vary a little by signer and region.",
          "Бейнелер — Slovo.",
        )}
      </p>
    </div>
  );
}

function NumbersRound({ set, entries, onExit }: { set: Set; entries: DictionaryEntry[]; onExit: () => void }) {
  const items = useMemo(() => shuffle(entries).slice(0, 10), [entries]);
  const [i, setI] = useState(0);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);
  const t = items[i];
  const options = useMemo(() => (t ? shuffle([t, ...shuffle(entries.filter((e) => e.id !== t.id)).slice(0, 3)]) : []), [t, entries]);
  if (!t)
    return (
      <section className="panel fs-done">
        <h2>{at("Готово!", "Done!", "Дайын!")}</h2>
        <p className="fs-score">{score} / {items.length}</p>
        <div className="fs-actions">
          <button className="button primary" onClick={onExit}>{at("К наборам", "To sets", "Жинақтарға")}</button>
        </div>
      </section>
    );
  const right = set.answer(t.label);
  function answer(ok: boolean) {
    setResult(ok);
    if (ok) setScore((s) => s + 1);
  }
  return (
    <div className="fs-round">
      <section className="panel fs-player">
        <video key={t.id} className="test-video" src={t.displayVideo || t.video} autoPlay loop muted playsInline controls />
      </section>
      <section className="panel fs-answer">
        <span className="eyebrow">{set.title} · {i + 1} / {items.length}</span>
        <h2>{set.hint}</h2>
        {set.typed ? (
          <form onSubmit={(e) => { e.preventDefault(); if (result === null && input.trim()) answer(digits(input, set.id === "time") === digits(right, set.id === "time")); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} inputMode="numeric" placeholder={set.id === "time" ? "7:45" : "12"} autoFocus disabled={result !== null} />
            <button className="button primary" type="submit" disabled={result !== null || !input.trim()}>{at("Проверить", "Check", "Тексеру")}</button>
          </form>
        ) : (
          <div className="vocab-choices">
            {options.map((o) => (
              <button key={o.id} className={result === null ? "" : o.id === t.id ? "right" : ""} onClick={() => result === null && answer(o.id === t.id)}>
                {o.label}
              </button>
            ))}
          </div>
        )}
        {result !== null && (
          <>
            <p className={`vocab-feedback ${result ? "ok" : "no"}`}>
              {result ? <Check size={18} /> : <X size={18} />} {right}{set.typed && right !== t.label ? ` (${t.label})` : ""}
            </p>
            <button className="button primary" onClick={() => { setI((n) => n + 1); setInput(""); setResult(null); }}>
              {at("Дальше", "Next", "Келесі")} <ArrowRight size={16} />
            </button>
          </>
        )}
        <p className="fs-progress">{at("Счёт", "Score", "Ұпай")}: {score}</p>
      </section>
    </div>
  );
}
