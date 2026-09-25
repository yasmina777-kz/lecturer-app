import { useSyncExternalStore } from "react";
import type { Language } from "../types/auth";
import { updatesEn, updatesKk } from "./updates";
import { marketingEn, marketingKk } from "./marketing";
import { en, kk } from "./messages";
const supported = ["ru", "en", "kk"];
let language: Language = "ru";
try {
  const stored = localStorage.getItem("lecturer-language");
  if (stored && supported.includes(stored)) language = stored as Language;
} catch {
  /* Private browsing may disable storage. */
}
document.documentElement.lang = language;
export function demoId() {
  return `00000000-0000-0000-0000-00000000000${language === "en" ? 2 : language === "kk" ? 3 : 1}`;
}
const listeners = new Set<() => void>();
export function getLanguage() {
  return language;
}
export function setLanguage(next: Language) {
  if (!supported.includes(next)) return;
  language = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem("lecturer-language", next);
  } catch {
    /* Keep the in-memory preference. */
  }
  listeners.forEach((fn) => fn());
}
export function t(source: string, ...values: (string | number)[]): string {
  let text =
    language === "en"
      ? (updatesEn[source] ?? marketingEn[source] ?? en[source] ?? source)
      : language === "kk"
        ? (updatesKk[source] ?? marketingKk[source] ?? kk[source] ?? source)
        : source;
  return text.replace(/\{(\d+)\}/g, (_, n) =>
    String(values[Number(n)] ?? `{${n}}`),
  );
}
export function useLanguage() {
  const current = useSyncExternalStore((fn) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, getLanguage);
  return { language: current, setLanguage, t };
}
