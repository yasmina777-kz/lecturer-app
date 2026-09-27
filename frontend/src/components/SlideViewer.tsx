import { at } from "../i18n/automation";
import { t } from "../i18n";
import { SlideVisual, type TeachingVisual } from "./SlideVisual";
import type { Slide } from "../types/lecture";
export function slideContent(slide: Slide) {
  try {
    return JSON.parse(slide.contentJson) as {
      title?: string;
      heading?: string;
      bullets?: string[];
      visual?: TeachingVisual;
      evidence?: string;
    };
  } catch {
    return {};
  }
}
export function SlideViewer({
  slide,
  index = 0,
  total = 1,
  subject = "",
}: {
  slide: Slide;
  index?: number;
  total?: number;
  subject?: string;
}) {
  const content = slideContent(slide);
  return (
    <div className="slide-viewer">
      <div className="slide-top">
        <span>{subject}</span>
        <span>AI MENTOR / {String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className={`slide-content ${content.visual ? "has-visual" : ""}`}>
        <span className="slide-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h2>{content.title || content.heading || t("Новая идея")}</h2>
        <div className="slide-detail-layout">
          <ul>
            {content.bullets?.map((b, i) => (
              <li key={i}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {b}
              </li>
            ))}
          </ul>
          {content.visual && <SlideVisual visual={content.visual} />}
        </div>
        {content.evidence && <details className="source-excerpt"><summary>{at("Опорный фрагмент материала", "Supporting source excerpt", "Материалдың тірек үзіндісі")}</summary><blockquote>{content.evidence}</blockquote></details>}
      </div>
      <div className="slide-footer">
        <span>{t("Одна идея — на шаг ближе к пониманию")}</span>
        <span>
          {index + 1} / {total}
        </span>
      </div>
      <div className="slide-decoration" />
    </div>
  );
}
