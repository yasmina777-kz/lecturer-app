import { t } from "../i18n";
import { useId } from "react";
import type { AvatarId } from "../types/auth";
export type AvatarState = "hidden" | "speaking" | "idle" | "thinking";
export function AvatarPlayer({
  state = "idle",
  style = "violet",
  compact = false,
  avatarId = "classic-male",
}: {
  state?: AvatarState;
  style?: string;
  compact?: boolean;
  avatarId?: AvatarId;
}) {
  const uid = useId().replace(/:/g, "");
  if (state === "hidden") return null;
  const female = avatarId === "classic-female";
  const color =
    style === "violet" ? "#778899" : style === "ocean" ? "#647888" : "#697780";
  return (
    <div
      className={`avatar-scene ${state} ${compact ? "compact" : ""}`}
      role="img"
      aria-label={
        state === "speaking" ? t("AI-лектор говорит") : t("AI-лектор")
      }
    >
      <div className="avatar-orbit orbit-one" />
      <div className="avatar-orbit orbit-two" />
      <svg
        className={`avatar-figure ${female ? "female-avatar" : ""}`}
        viewBox="0 0 320 360"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${uid}coat`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={color} />
            <stop offset="1" stopColor="#303b44" />
          </linearGradient>
          <linearGradient id={`${uid}skin`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#ebc5ab" />
            <stop offset="1" stopColor="#c99075" />
          </linearGradient>
        </defs>
        <ellipse
          cx="160"
          cy="347"
          rx="95"
          ry="10"
          fill="#21262b"
          opacity=".14"
        />
        <path
          d="M48 340Q42 250 110 229L209 229Q278 250 273 340Z"
          fill={`url(#${uid}coat)`}
        />
        <path d="M123 221L160 244 199 220 186 341H137Z" fill="#eee8de" />
        <path
          d="M108 231L123 221 147 302 112 280 119 263 99 252M211 232L199 221 175 302 211 280 203 263 224 250"
          fill={color}
          stroke="#fff"
          strokeOpacity=".12"
        />
        <path d="M137 183V226Q160 248 184 226V183" fill="#c48d71" />
        <g className="avatar-head">
          {female && (
            <path
              d="M92 113Q79 34 156 32Q236 25 232 116L243 222Q214 241 196 218L115 223Q80 237 82 208Z"
              fill="#493228"
            />
          )}
          {!female && (
            <path
              data-hair="male-back"
              d="M94 124Q87 48 155 42 230 33 229 125L211 186 108 186Z"
              fill="#332c27"
            />
          )}
          <ellipse cx="102" cy="142" rx="12" ry="21" fill="#d6a286" />
          <ellipse cx="220" cy="142" rx="12" ry="21" fill="#d6a286" />
          <path
            d="M107 99Q160 67 215 101V154Q208 205 162 211 115 203 106 157Z"
            fill={`url(#${uid}skin)`}
          />
          <path
            data-hair={female ? "female-front" : "male-front"}
            d={
              female
                ? "M94 124Q84 42 157 36Q235 32 231 122L213 99Q166 105 138 74Q121 109 105 124Z"
                : "M100 123Q90 74 119 58 168 18 209 62 233 83 219 123L208 89Q173 105 138 76 119 106 100 123"
            }
            fill={female ? "#493228" : "#332c27"}
          />
          <path
            d="M119 124Q130 117 143 123M181 123Q193 117 204 124"
            fill="none"
            stroke="#544033"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {female && (
            <path
              d="M112 139l-5-3m105 3l5-3"
              stroke="#54362e"
              strokeWidth="2"
            />
          )}
          <g className="avatar-eyes">
            <ellipse cx="132" cy="139" rx="4" ry="5" fill="#312c2a" />
            <ellipse cx="193" cy="139" rx="4" ry="5" fill="#312c2a" />
          </g>
          <g fill="none" stroke="#353d38" strokeWidth="3">
            <rect x="111" y="129" width="42" height="27" rx="10" />
            <rect x="174" y="129" width="42" height="27" rx="10" />
            <path d="M153 139Q162 133 174 139" />
          </g>
          <path
            d="M162 141L157 162 167 164"
            fill="none"
            stroke="#b7785b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M146 181Q162 191 179 180"
            fill="none"
            stroke="#875345"
            strokeWidth="3"
            strokeLinecap="round"
            className="avatar-smile"
          />
          <ellipse
            className="avatar-mouth"
            cx="162"
            cy="183"
            rx="11"
            ry="5"
            fill="#754337"
          />
        </g>
        <path
          d="M73 327L112 311M246 327L208 311"
          stroke="#3a454e"
          strokeWidth="3"
        />
        <rect x="205" y="268" width="24" height="16" rx="3" fill="#e1e3e5" />
        <path d="M211 273H223M211 278H219" stroke="#65717b" strokeWidth="2" />
      </svg>
      {!compact && (
        <div className="avatar-caption">
          <span className="status-dot" />
          {state === "thinking"
            ? t("Обдумываю ваш вопрос")
            : state === "speaking"
              ? t("Объясняю простыми словами")
              : t("Ваш персональный AI-лектор")}
        </div>
      )}
    </div>
  );
}
