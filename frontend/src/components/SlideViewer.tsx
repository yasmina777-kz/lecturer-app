import type { Slide } from "../types/lecture";

interface SlideContent {
  heading?: string;
  bullets?: string[];
}

interface SlideViewerProps {
  slide: Slide;
}

export function SlideViewer({ slide }: SlideViewerProps) {
  // ContentJson приходит с бэка как строка — распаковываем в объект для рендера
  let content: SlideContent = {};
  try {
    content = JSON.parse(slide.contentJson) as SlideContent;
  } catch {
    content = {};
  }

  return (
    <div className="slide-viewer">
      {content.heading && <h2>{content.heading}</h2>}
      {content.bullets && (
        <ul>
          {content.bullets.map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
