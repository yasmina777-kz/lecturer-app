/** Turns a short run of recognized signs into a Russian phrase.
 * RSL word order differs from Russian (e.g. «КАК ТЕБЯ ЗОВУТ?» is usually
 * signed ТЫ ИМЯ (КТО?)), so patterns are order-insensitive sets of course
 * signs. This is a small rule table, not a grammar translator.
 */
export const PHRASES: { signs: string[]; text: string }[] = [
  { signs: ["ты", "имя", "кто?"], text: "Как тебя зовут?" },
  { signs: ["тебя", "имя", "кто?"], text: "Как тебя зовут?" },
  { signs: ["ты", "имя"], text: "Как тебя зовут?" },
  { signs: ["тебя", "имя"], text: "Как тебя зовут?" },
  { signs: ["я", "имя"], text: "Меня зовут" },
  { signs: ["меня", "имя"], text: "Меня зовут" },
  { signs: ["ты", "кто?"], text: "Кто ты?" },
  { signs: ["я", "не", "понять"], text: "Я не понимаю" },
  { signs: ["помочь", "я"], text: "Помогите мне" },
  { signs: ["сколько", "ты", "год"], text: "Сколько тебе лет?" },
  { signs: ["я", "любить", "ты"], text: "Я тебя люблю" },
  { signs: ["я", "хотеть", "есть"], text: "Я хочу есть" },
  { signs: ["я", "хотеть", "спать"], text: "Я хочу спать" },
  { signs: ["что", "это"], text: "Что это?" },
];
export const PHRASE_WINDOW_MS = 8000;

/** recent: newest last. Returns how many trailing words form a phrase. */
export function composePhrase(recent: { label: string; at: number }[], now: number) {
  const live = recent.filter((r) => now - r.at <= PHRASE_WINDOW_MS);
  for (const p of [...PHRASES].sort((a, b) => b.signs.length - a.signs.length)) {
    const n = p.signs.length;
    if (live.length < n) continue;
    const tail = live.slice(-n).map((r) => r.label.toLocaleLowerCase("ru"));
    const want = p.signs.map((s) => s.toLocaleLowerCase("ru"));
    if ([...tail].sort().join("|") === [...want].sort().join("|"))
      return { count: n, text: p.text, words: live.slice(-n).map((r) => r.label) };
  }
  return null;
}

/** Replace the last `words` in a transcript (as written by appendTranslation). */
export function replaceTail(text: string, words: string[], phrase: string) {
  const clean = words.map((w) => w.replace(/[!?.]$/u, ""));
  const escaped = clean.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  const re = new RegExp(`(^|\\s)${escaped}\\s*$`, "iu");
  if (!re.test(text)) return text;
  const replaced = text.replace(re, (_m, lead) => `${lead}${phrase}`);
  return replaced.charAt(0).toLocaleUpperCase("ru") + replaced.slice(1);
}
