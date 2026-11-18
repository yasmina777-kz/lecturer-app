import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { at } from "../i18n/automation";
import type { DictionaryEntry } from "../sign/dictionary";
import type { MotionPlan, MotionStep } from "../sign/motion";
import { HumanSequencePlayer } from "./HumanSequencePlayer";
import "./sign-chain.css";

let catalog: Promise<DictionaryEntry[]> | null = null;
export function loadWordCatalog() {
  catalog ??= fetch("/research/rsl/words/catalog.json")
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => {
      catalog = null;
      return [];
    });
  return catalog;
}
export function useWordCatalog() {
  const [words, setWords] = useState<DictionaryEntry[] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadWordCatalog().then((w) => alive && setWords(w));
    return () => {
      alive = false;
    };
  }, []);
  return words;
}

/** Real signer videos for a list of dictionary signs, played one after another. */
export function SignChain({ signs, autoPlay = true, compact = false }: { signs: string[]; autoPlay?: boolean; compact?: boolean }) {
  const words = useWordCatalog();
  const plan = useMemo<MotionPlan | null>(() => {
    if (!words) return null;
    const steps: MotionStep[] = [];
    const missing: string[] = [];
    signs.forEach((label, i) => {
      const w = words.find((x) => x.label === label);
      if (!w) return missing.push(label);
      steps.push({
        id: `${w.id}-${i}`,
        label: w.label,
        text: w.label.replace(/[!?]$/, ""),
        reference: w.displayVideo ?? w.video,
        url: "",
        duration: 2,
      } as unknown as MotionStep);
    });
    return { steps, missing, spelling: false } as MotionPlan;
  }, [words, signs.join("|")]);
  useEffect(() => {
    // Warm the cache so the chain plays without gaps.
    plan?.steps.forEach((s) => void fetch(s.reference!).catch(() => {}));
  }, [plan]);
  if (!plan) return <div className={`sign-chain${compact ? " sign-chain-small" : ""}`} />;
  return (
    <div className={`sign-chain${compact ? " sign-chain-small" : ""}`}>
      <HumanSequencePlayer plan={plan} autoPlay={autoPlay} />
    </div>
  );
}

const norm = (s: string) => s.replace(/[!?]$/, "").toLocaleUpperCase("ru");
function shuffled<T>(a: T[]) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  if (r.length > 1 && r.every((x, i) => x === a[i])) r.push(r.shift()!);
  return r;
}

/** Arrange sign tiles in RSL order. Several orders may be accepted. */
export function OrderTask({
  ru, answer, also = [], extra = [], why, onResult,
}: {
  ru: string;
  answer: string[];
  also?: string[][];
  extra?: string[];
  why?: string;
  onResult?: (ok: boolean) => void;
}) {
  const tiles = useMemo(() => shuffled([...answer, ...extra.filter((e) => !answer.includes(e))]), [answer.join("|"), extra.join("|")]);
  const [picked, setPicked] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const chosen = picked.map((i) => tiles[i]);
  function check() {
    const ok = [answer, ...also].some((a) => a.length === chosen.length && a.every((x, i) => x === chosen[i]));
    setResult(ok);
    onResult?.(ok);
  }
  return (
    <div className="order-task">
      <p className="order-ru">«{ru}»</p>
      <div className="order-line" aria-label={at("Ваш порядок", "Your order", "Сіздің рет")}>
        {chosen.length ? (
          chosen.map((t, k) => (
            <button key={k} disabled={result !== null} onClick={() => setPicked(picked.filter((_, j) => j !== k))}>
              {norm(t)}
            </button>
          ))
        ) : (
          <span>{at("Нажимайте на жесты по порядку", "Tap the signs in order", "Ымдарды ретімен басыңыз")}</span>
        )}
      </div>
      <div className="order-tiles">
        {tiles.map((t, i) => (
          <button key={i} disabled={picked.includes(i) || result !== null} onClick={() => setPicked([...picked, i])}>
            {norm(t)}
          </button>
        ))}
      </div>
      {result === null ? (
        <button className="button primary" disabled={chosen.length !== answer.length} onClick={check}>
          <Check size={18} />
          {at("Проверить", "Check", "Тексеру")}
        </button>
      ) : (
        <div className={`order-result ${result ? "ok" : "no"}`} role="status">
          {result ? <Check size={18} /> : <X size={18} />}
          <span>
            {result ? at("Верно!", "Correct!", "Дұрыс!") : `${at("Правильно", "Correct", "Дұрысы")}: ${answer.map(norm).join(" ")}`}
            {why ? ` — ${why}` : ""}
          </span>
          {!result && (
            <button className="button secondary" onClick={() => { setPicked([]); setResult(null); }}>
              <RotateCcw size={16} />
              {at("Ещё раз", "Retry", "Қайта")}
            </button>
          )}
        </div>
      )}
      {result !== null && <SignChain signs={answer} compact />}
    </div>
  );
}
