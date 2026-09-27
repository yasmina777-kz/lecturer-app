import { getLanguage } from "./index";
// Explicit translations for the automation workspace.
export function at(ru: string, en: string, kk: string) {
  return getLanguage() === "en" ? en : getLanguage() === "kk" ? kk : ru;
}
