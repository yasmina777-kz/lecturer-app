import type { MotionAsset } from "./motion";

export type DictionaryEntry = {
  id: string;
  label: string;
  category: string;
  video: string;
  poster?: string;
  source: string;
  dataset: string;
  attachmentId?: string;
};
export type DictionaryForms = Record<string, string[]>;
export type TextPiece = {
  text: string;
  entry?: DictionaryEntry;
  ambiguous?: boolean;
  inflected?: boolean;
  punctuation?: boolean;
};
export const normalizeSignText = (text: string) =>
  text
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .trim()
    .replace(/[?!.,]+$/u, "")
    .trim()
    .replace(/\s+/gu, " ");

/** Include authored lessons only when their actual animation is available.
 * An authored animation is not a human reference video or a reviewed sign.
 */
export function learningDictionary(
  words: DictionaryEntry[],
  motions: MotionAsset[],
): DictionaryEntry[] {
  const entries = [...alphabetEntries(), ...words];
  const ids = new Set(entries.map((entry) => entry.id));
  const labels = new Set(
    entries.map((entry) => normalizeSignText(entry.label)),
  );
  for (const motion of motions) {
    if (
      !motion.id.startsWith("prepared-") ||
      ids.has(motion.id) ||
      labels.has(normalizeSignText(motion.label))
    )
      continue;
    entries.push({
      id: motion.id,
      label: motion.label,
      category: motion.id === "prepared-name-demo" ? "Фразы" : "Общение",
      video: motion.reference?.startsWith("/research/") ? motion.reference : "",
      source: motion.source?.startsWith("https://") ? motion.source : "",
      dataset: "AI Mentor · экспериментальная анимация",
    });
    ids.add(motion.id);
    labels.add(normalizeSignText(motion.label));
  }
  return entries;
}

export function matchesDictionary(
  entry: DictionaryEntry,
  query: string,
  forms: DictionaryForms,
): boolean {
  const normalized = normalizeSignText(query);
  return (
    normalizeSignText(entry.label).includes(normalized) ||
    (forms[normalized] ?? []).includes(entry.id)
  );
}
/** Dictionary decomposition in source order, explicitly NOT a grammar translator.
 * Unknown tokens and negation remain visible; never silently omit them.
 */
export function decomposeText(
  text: string,
  entries: DictionaryEntry[],
  forms: DictionaryForms,
  spelling = false,
): TextPiece[] {
  const byLabel = new Map(entries.map((e) => [normalizeSignText(e.label), e]));
  const byId = new Map(entries.map((e) => [e.id, e]));
  if (spelling)
    return Array.from(text.normalize("NFKC"))
      .filter((c) => !/^\s$/u.test(c))
      .map((c) => ({
        text: c,
        entry: entries.find(
          (e) =>
            e.category === "Алфавит" &&
            e.label.toLocaleLowerCase("ru") === c.toLocaleLowerCase("ru"),
        ),
        punctuation: /^[.,!?;:—–-]$/u.test(c),
      }));
  const tokens =
    text
      .normalize("NFKC")
      .match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu) ?? [];
  const result: TextPiece[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^[.,!?;:—–-]$/u.test(token)) {
      result.push({ text: token, punctuation: true });
      continue;
    }
    let match: DictionaryEntry | undefined,
      size = 0;
    for (let n = Math.min(5, tokens.length - i); n >= 1; n--) {
      const part = tokens.slice(i, i + n);
      if (part.some((t) => /^[.,!?;:]$/.test(t))) continue;
      const found = byLabel.get(normalizeSignText(part.join(" ")));
      if (found) {
        match = found;
        size = n;
        break;
      }
    }
    if (match) {
      result.push({ text: tokens.slice(i, i + size).join(" "), entry: match });
      i += size - 1;
      continue;
    }
    // Resolve only explicit pronoun variants; other ambiguous words still require a choice.
    const pronounAlias: Record<string, string> = {
      мне: "меня",
      мной: "меня",
      мною: "меня",
      тебе: "тебя",
      тобой: "тебя",
      тобою: "тебя",
    };
    const alias = pronounAlias[token.toLocaleLowerCase("ru")];
    const aliasEntry = alias ? byLabel.get(alias) : undefined;
    if (aliasEntry) {
      result.push({ text: token, entry: aliasEntry, inflected: true });
      continue;
    }
    const candidates = (forms[token.toLocaleLowerCase("ru")] ?? [])
      .map((id) => byId.get(id))
      .filter((e): e is DictionaryEntry => !!e);
    result.push({
      text: token,
      ...(candidates.length === 1
        ? { entry: candidates[0], inflected: true }
        : candidates.length > 1
          ? { ambiguous: true }
          : {}),
    });
  }
  return result;
}
export function alphabetEntries(): DictionaryEntry[] {
  return Array.from("АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ").map((letter) => ({
    id: "letter-" + letter.codePointAt(0)!.toString(16),
    label: letter,
    category: "Алфавит",
    dataset: "Bukva",
    source: "https://github.com/ai-forever/bukva",
    video: `/research/rsl/alphabet/${letter.codePointAt(0)!.toString(16).padStart(4, "0")}.mp4`,
  }));
}
