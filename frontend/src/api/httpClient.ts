// Адрес backend. В реальном проекте — через переменную окружения (.env),
// здесь для простоты MVP — константа.
export const API_BASE_URL = "http://localhost:5000/api";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
