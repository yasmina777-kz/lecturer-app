import { phraseGroups } from "./phraseExamples";
/** Decorative signed-communication scenes, not instructional handshape diagrams. */
export function phraseArt(phrase: string) {
  const group = phraseGroups.findIndex((group) => group.phrases.some(item => item === phrase));
  if (group < 0) return undefined;
  const image = /купить|хлеб|есть|воду/.test(phrase)
    ? "shop-signing-v1"
    : ["conversation", "practice", "workshop", "conversation"][group];
  return `/images/landing-v2/${image}.webp`;
}
