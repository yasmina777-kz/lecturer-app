import type { Lecture } from "../types/lecture";
export interface StudySource {
  id: string;
  title: string;
  text: string;
  slideIndex?: number;
}
export interface LocalAnswer {
  found: boolean;
  source?: StudySource;
  score: number;
}
export type EngineProgress = {
  stage: "loading" | "indexing" | "searching";
  completed?: number;
  total?: number;
};
export function splitSources(sources: StudySource[]): StudySource[] {
  const result: StudySource[] = [];
  for (const source of sources) {
    const text = source.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    let chunk = "";
    let part = 0;
    const push = () => {
      if (chunk.trim())
        result.push({
          ...source,
          id: `${source.id}:${part++}`,
          text: chunk.trim(),
        });
      chunk = "";
    };
    for (const sentence of text.match(/[^.!?]+[.!?]*\s*/g) || [text]) {
      for (let offset = 0; offset < sentence.length; offset += 550) {
        const piece = sentence.slice(offset, offset + 550);
        if (chunk.length + piece.length > 650) push();
        chunk += piece;
      }
    }
    push();
  }
  if (result.length > 80) throw new Error("MATERIAL_TOO_LARGE");
  return result;
}
export function lectureSources(lecture: Lecture): StudySource[] {
  return lecture.slides.map((s, i) => {
    let content: { title?: string; heading?: string; bullets?: string[] } = {};
    try {
      content = JSON.parse(s.contentJson);
    } catch {}
    return {
      id: s.id,
      title: content.title || content.heading || `${i + 1}`,
      text: s.narrationText || content.bullets?.join(". ") || "",
      slideIndex: i,
    };
  });
}
export function rankSources(
  query: number[],
  vectors: number[][],
  sources: StudySource[],
): LocalAnswer {
  if (!query.length || vectors.length !== sources.length)
    throw new Error("INVALID_EMBEDDINGS");
  const ranked = vectors
    .map((v, i) => ({
      i,
      score: v.reduce((sum, n, j) => sum + n * (query[j] || 0), 0),
    }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  // Similarity is a retrieval signal, not a probability that an answer is correct.
  if (!best || !Number.isFinite(best.score) || best.score < 0.84)
    return { found: false, score: best?.score || 0 };
  return { found: true, source: sources[best.i], score: best.score };
}
