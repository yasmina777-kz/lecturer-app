// Cropped from the chart supplied by the project owner; Ё is not in that chart.
const illustratedLetters = new Set(Array.from("АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"));
export function alphabetIllustration(letter: string): string | undefined {
  return illustratedLetters.has(letter)
    ? `/images/rsl-alphabet/${letter.codePointAt(0)!.toString(16).padStart(4, "0")}.webp`
    : undefined;
}
