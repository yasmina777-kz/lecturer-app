import type { TextPiece } from "./dictionary";

/** A few well-known RSL ordering habits applied to a word-by-word decomposition.
 * Not a full grammar translator — rules a signer should still review:
 *  * prepositions, conjunctions, particles and copula forms have no sign of
 *    their own and are dropped (instead of being shown as a stray letter);
 *  * time words open the sentence (ВЧЕРА Я МАГАЗИН ИДТИ);
 *  * in a question, the question word moves to the end (ТЫ ИМЯ КТО?).
 */
const FUNCTION_WORDS = new Set(
  "в во на к ко с со о об обо у по за из изо от до для при про через над под перед без и а но же ли ведь вот бы ну был была было были будет будут является являются это-то".split(" "),
);
const TIME_WORDS = new Set(
  "вчера завтра сегодня послезавтра позавчера сейчас теперь утром вечером днём днем ночью давно скоро раньше недавно потом".split(" "),
);
const QUESTION_WORDS = new Set(
  "кто кого кому кем что чего чему чем где когда как почему зачем сколько какой какая какое какие куда откуда чей чья чьё чьи".split(" "),
);

/** Phrases whose Russian wording has no sign-for-sign equivalent. */
const REWRITES: [RegExp, string][] = [
  [/(^|[^\p{L}])как\s+(тебя|тебе)\s+зовут(?=[^\p{L}]|$)/giu, "$1ты имя кто"],
  [/(^|[^\p{L}])как\s+(вас|вам)\s+зовут(?=[^\p{L}]|$)/giu, "$1вы имя кто"],
  [/(^|[^\p{L}])меня\s+зовут(?=[^\p{L}]|$)/giu, "$1я имя"],
];

export function rslRewrite(text: string) {
  return REWRITES.reduce((t, [re, to]) => t.replace(re, to), text);
}

const low = (p: TextPiece) => p.text.toLocaleLowerCase("ru");

export function toRslOrder(pieces: TextPiece[]): { pieces: TextPiece[]; dropped: string[] } {
  const out: TextPiece[] = [];
  const dropped: string[] = [];
  let sentence: TextPiece[] = [];
  const flush = (end?: TextPiece) => {
    const isQuestion = end?.text === "?";
    const time = sentence.filter((p) => TIME_WORDS.has(low(p)));
    const question = isQuestion ? sentence.filter((p) => QUESTION_WORDS.has(low(p).replace(/\?$/u, ""))) : [];
    const rest = sentence.filter((p) => !time.includes(p) && !question.includes(p));
    out.push(...time, ...rest, ...question);
    if (end) out.push(end);
    sentence = [];
  };
  for (const p of pieces) {
    if (p.punctuation) {
      if (/^[.!?]$/u.test(p.text)) flush(p);
      continue; // commas and dashes carry no sign
    }
    const word = low(p);
    const letterOnly = p.entry?.category === "Алфавит";
    if (FUNCTION_WORDS.has(word) && (!p.entry || letterOnly)) {
      dropped.push(p.text);
      continue;
    }
    sentence.push(p);
  }
  flush();
  // «кто» in a rewritten question resolves to the «кто?» sign by label.
  return { pieces: out, dropped };
}

/** Text in RSL sign order, for planMotion: reorder and drop words, then let
 * the regular dictionary lookup match the result. */
export function rslOrderText(
  text: string,
  decompose: (t: string) => TextPiece[],
): { text: string; dropped: string[] } {
  const { pieces, dropped } = toRslOrder(decompose(rslRewrite(text)));
  let out = "";
  for (const p of pieces) out += p.punctuation ? p.text : (out && !out.endsWith(" ") ? " " : "") + p.text;
  return { text: out.replace(/([.!?])(?=\S)/gu, "$1 ").trim(), dropped };
}
