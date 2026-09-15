import { apiGet } from "./httpClient";
import type { Lecture } from "../types/lecture";

export async function getLecture(lectureId: string): Promise<Lecture> {
  return apiGet<Lecture>(`/lectures/${lectureId}`);
}
