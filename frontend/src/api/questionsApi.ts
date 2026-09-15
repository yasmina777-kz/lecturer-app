import { API_BASE_URL } from "./httpClient";
import type { AskQuestionResponse } from "../types/lecture";

// Отправляем аудио вопроса как multipart/form-data — так его ожидает
// [FromForm] IFormFile audio в QuestionsController на бэке.
export async function askQuestion(
  lectureId: string,
  slideId: string,
  audioBlob: Blob
): Promise<AskQuestionResponse> {
  const formData = new FormData();
  formData.append("lectureId", lectureId);
  formData.append("slideId", slideId);
  formData.append("audio", audioBlob, "question.webm");

  const response = await fetch(`${API_BASE_URL}/questions/ask`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Ask question failed: ${response.status}`);
  }

  return response.json() as Promise<AskQuestionResponse>;
}
