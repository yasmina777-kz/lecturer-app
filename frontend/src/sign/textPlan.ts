// Intentionally a prepared-phrase lookup, not an AI translator.
export const supportedPhrase = "Как тебя зовут?";
export const preparedSigns = [
  { phrase: "А", animation: "a" },
  { phrase: "В", animation: "v" },
  { phrase: "Г", animation: "g" },
  { phrase: "Л", animation: "l" },
  { phrase: "У", animation: "u" },
  { phrase: "Ш", animation: "sh" },
  { phrase: "Ы", animation: "y" },
  { phrase: "Здравствуйте", animation: "hello" },
  { phrase: "Спасибо", animation: "thanks" },
  { phrase: supportedPhrase, animation: "name-demo" },
] as const;
export type TextPlan =
  | {
      ok: true;
      phrase: string;
      animation: (typeof preparedSigns)[number]["animation"];
    }
  | { ok: false; reason: "empty" | "too-long" | "unsupported" };
export function planText(text: string): TextPlan {
  if (!text.trim()) return { ok: false, reason: "empty" };
  if (text.length > 500) return { ok: false, reason: "too-long" };
  const normalized = text
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .trim()
    .replace(/[?!.]+$/u, "")
    .trim()
    .replace(/\s+/gu, " ");
  const match = preparedSigns.find(
    (sign) =>
      sign.phrase.toLocaleLowerCase("ru").replace(/[?!.]+$/u, "") ===
      normalized,
  );
  if (match)
    return { ok: true, phrase: match.phrase, animation: match.animation };
  return { ok: false, reason: "unsupported" };
}
