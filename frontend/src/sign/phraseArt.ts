import { phraseGroups } from "./phraseExamples";
const phrases = phraseGroups.flatMap((group) => [...group.phrases]);
/** Decorative signed-communication scenes, not instructional handshape diagrams. */
export function phraseArt(phrase: string) {
  const index = phrases.findIndex((item) => item === phrase);
  return index < 0
    ? undefined
    : `/illustrations/sign-phrases/phrase-${String(index + 1).padStart(2, "0")}.jpg`;
}
