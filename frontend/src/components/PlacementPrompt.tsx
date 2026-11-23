import { useState } from "react";
import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { at } from "../i18n/automation";
import { readPlacement, savePlacement } from "../sign/levelTests";
import "./placement.css";

/** First visit: offer a short test so people who already sign skip ahead. */
export function PlacementPrompt({ hasHistory }: { hasHistory: boolean }) {
  const [hidden, setHidden] = useState(() => hasHistory || !!readPlacement());
  if (hidden) return null;
  return (
    <section className="placement-prompt card-motion" aria-label={at("Тест уровня", "Placement test", "Деңгей тесті")}>
      <Compass size={28} aria-hidden="true" />
      <div>
        <strong>{at("Уже знаете жесты?", "Already know some signs?", "Ымдарды білесіз бе?")}</strong>
        <p>{at("Пройдите короткий тест — 12 вопросов, около 5 минут. Мы подберём уровень, и вам не придётся начинать с нуля.", "Take a short test — 12 questions, about 5 minutes — and we’ll pick your level.", "Қысқа тест — 12 сұрақ. Деңгейіңізді табамыз.")}</p>
      </div>
      <div className="placement-actions">
        <Link className="button primary" to="/learn-test?placement=1">{at("Пройти тест", "Take the test", "Тест тапсыру")}</Link>
        <button
          className="button secondary"
          onClick={() => {
            savePlacement({ skipped: true, at: new Date().toISOString() });
            setHidden(true);
          }}
        >
          {at("Начну с нуля", "Start from zero", "Нөлден бастаймын")}
        </button>
      </div>
    </section>
  );
}
