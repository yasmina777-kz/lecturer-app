/** Circular progress (done / total) used in page heroes; styled by `.course-ring` in course.css. */
export function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 34, c = 2 * Math.PI * r, part = total ? done / total : 0;
  return (
    <div className="course-ring" aria-label={`${done} / ${total}`}>
      <svg viewBox="0 0 80 80" width="80" height="80">
        <circle cx="40" cy="40" r={r} className="track" />
        <circle cx="40" cy="40" r={r} className="bar" strokeDasharray={c} strokeDashoffset={c * (1 - part)} />
      </svg>
      <span><strong>{done}</strong>/{total}</span>
    </div>
  );
}
