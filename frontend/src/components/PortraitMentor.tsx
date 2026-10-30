import { at } from "../i18n/automation";
import type { AvatarState } from "./AvatarPlayer";

/** A rendered portrait; the meter indicates speech without simulating lip sync. */
export function PortraitMentor({
  state,
  compact,
}: {
  state: AvatarState;
  compact: boolean;
}) {
  const status =
    state === "speaking"
      ? at("Мира объясняет", "Mira is speaking", "Мира түсіндіріп жатыр")
      : state === "thinking"
        ? at(
            "Мира обдумывает вопрос",
            "Mira is thinking",
            "Мира сұрақты ойластырып жатыр",
          )
        : at("Мира · AI Mentor", "Mira · AI Mentor", "Мира · AI Mentor");
  return (
    <div
      className={`avatar-scene human-avatar portrait-mentor ${state} ${compact ? "compact" : ""}`}
      role="img"
      aria-label={status}
    >
      <div className="portrait-mentor-aura" aria-hidden="true" />
      <img
        className="portrait-mentor-image"
        src="/images/avatars/mira-portrait-v3.png"
        width="1140"
        height="1380"
        alt=""
        decoding="async"
      />
      {state === "speaking" && (
        <div className="portrait-speech-meter" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} style={{ animationDelay: `${i * -0.11}s` }} />
          ))}
        </div>
      )}
      {!compact && (
        <div className="avatar-caption">
          <span className="status-dot" />
          {status}
        </div>
      )}
    </div>
  );
}
