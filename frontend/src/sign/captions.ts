/** Caption assembly never guesses words or turns rejected predictions into text. */
export type CaptionPrediction = { accepted: boolean; label: string } | null;
export function appendRecognizedLetter(
  text: string,
  prediction: CaptionPrediction,
): string {
  if (!prediction?.accepted || !/^[А-ЯЁ]$/u.test(prediction.label)) return text;
  return (text + prediction.label).slice(0, 2000);
}
/** A release must be observed between automatic captures, including repeated letters. */
export function releaseGate(
  emptyFrames: number,
  handsVisible: boolean,
): { emptyFrames: number; released: boolean } {
  const next = handsVisible ? 0 : emptyFrames + 1;
  return { emptyFrames: next, released: next >= 5 };
}
