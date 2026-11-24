import { useSyncExternalStore } from "react";
import { KK_PHRASES, KK_TIPS, KK_WORDS } from "./kazakhGlossary";
import { KK_WORDS_EXTRA } from "./kazakhGlossaryExtra";

/** Which sign language the learner studies. Same sign videos (Kazakh-Russian
 * SL shares most signs with RSL); the written side, the alphabet (33 vs 42
 * letters) and fingerspelling recognition change. */
export type SignLang = "rsl" | "ksl";
const KEY = "sign-language";
let current: SignLang = "rsl";
try {
  if (localStorage.getItem(KEY) === "ksl") current = "ksl";
} catch {
  /* storage may be disabled */
}
const listeners = new Set<() => void>();
export const getSignLang = () => current;
export function setSignLang(next: SignLang) {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* keep in memory */
  }
  listeners.forEach((fn) => fn());
}
export function useSignLang() {
  const lang = useSyncExternalStore((fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, getSignLang);
  return [lang, setSignLang] as const;
}

const clean = (w: string) => w.replace(/[!?]$/, "");
/** Written form of a course word for the chosen sign language. */
export function wordText(label: string, lang: SignLang = current): string {
  return lang === "ksl" ? clean(KK_WORDS[label] ?? KK_WORDS_EXTRA[label] ?? label) : clean(label);
}
/** Written form of a course phrase for the chosen sign language. */
export function phraseText(ru: string, lang: SignLang = current): string {
  return lang === "ksl" ? KK_PHRASES[ru] ?? ru : ru;
}
/** Grammar tip of a phrase for the chosen sign language. */
export function tipText(ru: string, lang: SignLang = current): string {
  return lang === "ksl" ? KK_TIPS[ru] ?? ru : ru;
}
