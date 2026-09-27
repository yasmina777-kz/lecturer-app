import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { t } from "../i18n";

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? t("Включить светлую тему") : t("Включить тёмную тему");
  return (
    <button type="button" className="theme-switcher" onClick={toggleTheme} aria-label={label} title={label}>
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
