import { post } from "./httpClient";
import type { AskQuestionResponse } from "../types/lecture";
export function askQuestion(
  lectureId: string,
  slideId: string,
  question: string | Blob,
) {
  const body = new FormData();
  body.append("lectureId", lectureId);
  body.append("slideId", slideId);
  if (typeof question === "string") body.append("text", question);
  else
    body.append(
      "audio",
      question,
      question.type.includes("mp4") ? "question.mp4" : "question.webm",
    );
  return post<AskQuestionResponse>("/questions/ask", body);
}
