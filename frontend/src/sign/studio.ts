import { decomposeText, type DictionaryEntry, type DictionaryForms } from "./dictionary";

/** One subtitle line. Times are seconds; absent when the text has no timing. */
export type Cue = { text: string; start?: number; end?: number };
/** sign = exact dictionary sign, form = matched through a word form,
 * spell = shown letter by letter, skip = function word RSL usually drops,
 * none = no way to show it (numbers, latin). */
export type WordKind = "sign" | "form" | "spell" | "skip" | "none";
export type Clip = { src: string; label: string; letter: boolean };
export type StudioWord = { text: string; kind: WordKind; clips: Clip[] };
export type ScheduleItem = Clip & { start: number; end: number; rate: number; cue: number };
export type Position = "br" | "bl" | "tr" | "tl";

export type StudioTemplate = {
  id: string;
  title: string;
  band: string;
  color: string;
  position: Position;
  size: number;
  captions: boolean;
  script: string;
};

export const TEMPLATES: StudioTemplate[] = [
  {
    id: "news",
    title: "Новости",
    band: "НОВОСТИ",
    color: "#1d4ed8",
    position: "br",
    size: 0.46,
    captions: true,
    script: "Добрый вечер!\nСегодня новости города.\nВ городе открыли новую школу.\nЛюди очень рады.\nЗавтра новая неделя.",
  },
  {
    id: "weather",
    title: "Погода",
    band: "ПОГОДА",
    color: "#0e7490",
    position: "bl",
    size: 0.46,
    captions: true,
    script: "Добрый вечер!\nПогода на завтра.\nУтро холодное, день тёплый.\nСолнце и сильный ветер.\nВечером будет дождь.",
  },
  {
    id: "alert",
    title: "Экстренное сообщение",
    band: "ЭКСТРЕННОЕ СООБЩЕНИЕ",
    color: "#b91c1c",
    position: "br",
    size: 0.6,
    captions: true,
    script: "Важно!\nСегодня вечером опасная погода.\nСильный ветер и холод.\nОстаньтесь дома.\nНе выходите на улицу.",
  },
];

// Prepositions and particles that RSL normally leaves out. Only skipped when
// the dictionary has no sign for them.
const STOP = new Set(
  "в во на и а но с со к ко по от до у о об обо за из изо для же ли бы ведь вот то-то".split(" "),
);

const seconds = (s: string) => {
  const m = s.trim().match(/^(?:(\d+):)?(\d+):(\d+)[.,](\d+)/);
  if (!m) return NaN;
  return +(m[1] ?? 0) * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, "0").slice(0, 3) / 1000;
};

/** Reads .srt and .vtt subtitles. */
export function parseSubtitles(source: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of source.replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = block.split("\n").filter((l) => l.trim());
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, z = ""] = lines[i].split("-->");
    const text = lines
      .slice(i + 1)
      .join(" ")
      .replace(/<[^>]+>|\{[^}]+\}/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const start = seconds(a);
    const end = seconds(z.trim().split(/\s+/)[0] ?? "");
    if (text && Number.isFinite(start) && Number.isFinite(end) && end > start) cues.push({ text, start, end });
  }
  return cues;
}

export function formatTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Spreads untimed lines over the video by their length. */
export function timeCues(cues: Cue[], duration: number): Cue[] {
  if (!duration || cues.every((c) => c.start !== undefined && c.end !== undefined)) return cues;
  const weight = cues.map((c) => c.text.split(/\s+/).filter(Boolean).length + 1);
  const total = weight.reduce((a, b) => a + b, 0) || 1;
  const span = Math.max(0, duration - 0.6);
  let t = 0.3;
  return cues.map((c, i) => {
    const d = (span * weight[i]) / total;
    const cue = { text: c.text, start: t, end: t + d };
    t += d;
    return cue;
  });
}

const clipOf = (e: DictionaryEntry, letter = false): Clip => ({
  src: e.displayVideo ?? e.video,
  label: e.label.replace(/[!?]$/u, ""),
  letter,
});

/** Russian text → the dictionary signs to show. Not a grammar translator:
 * word order stays as written, unknown words are fingerspelled. */
export function translateCue(
  text: string,
  words: DictionaryEntry[],
  forms: DictionaryForms,
  letters: DictionaryEntry[],
): StudioWord[] {
  const byId = new Map(words.map((w) => [w.id, w]));
  const letter = new Map(letters.map((l) => [l.label, l]));
  const out: StudioWord[] = [];
  for (const p of decomposeText(text, words, forms)) {
    if (p.punctuation) continue;
    const lower = p.text.toLocaleLowerCase("ru");
    if (p.entry?.video) {
      out.push({ text: p.text, kind: p.inflected ? "form" : "sign", clips: [clipOf(p.entry)] });
      continue;
    }
    const guess = p.ambiguous ? (forms[lower] ?? []).map((id) => byId.get(id)).find((e) => e?.video) : undefined;
    if (guess) {
      out.push({ text: p.text, kind: "form", clips: [clipOf(guess)] });
      continue;
    }
    if (STOP.has(lower)) {
      out.push({ text: p.text, kind: "skip", clips: [] });
      continue;
    }
    const chars = Array.from(p.text.toLocaleUpperCase("ru")).filter((c) => /\p{L}/u.test(c));
    const spelled = chars.map((c) => letter.get(c));
    if (chars.length && spelled.every(Boolean))
      out.push({ text: p.text, kind: "spell", clips: spelled.map((e) => clipOf(e!, true)) });
    else out.push({ text: p.text, kind: "none", clips: [] });
  }
  return out;
}

/** Places every clip on the timeline. A line starts at its subtitle time; clips
 * are sped up (at most 2×) to fit, and never overlap the previous line. */
export function buildSchedule(cues: Cue[], translated: StudioWord[][], duration: (src: string) => number): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  let prev = 0;
  cues.forEach((cue, ci) => {
    const clips = (translated[ci] ?? []).flatMap((w) => w.clips);
    if (!clips.length) return;
    const base = clips.map((c) => (c.letter ? 1.7 : 1.15));
    const natural = clips.reduce((s, c, i) => s + duration(c.src) / base[i], 0);
    const start = Math.max(cue.start ?? prev + 0.3, prev);
    const room = cue.end !== undefined ? cue.end - start : natural;
    const factor = Math.min(2, Math.max(1, natural / Math.max(room, 0.5)));
    let t = start;
    clips.forEach((c, i) => {
      const rate = base[i] * factor;
      const d = duration(c.src) / rate;
      items.push({ ...c, start: t, end: t + d, rate, cue: ci });
      t += d;
    });
    prev = t;
  });
  return items;
}

/** Index of the clip playing at time t, or of the last finished one. */
export function itemAt(items: ScheduleItem[], t: number) {
  let lo = 0,
    hi = items.length - 1,
    found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid].start <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}
