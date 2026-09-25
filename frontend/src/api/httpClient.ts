import { t } from "../i18n";
export const API_BASE_URL = "/api";
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      t("Нет связи с сервером. Проверьте подключение и попробуйте снова."),
    );
  }
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("session-expired"));
    const body = await response.json().catch(() => ({}));
    const errors = body.errors
      ? (Object.values(body.errors).flat() as string[]).join(" ")
      : "";
    throw new Error(
      t(body.message || "") ||
        (errors ? t("Проверьте заполнение полей формы.") : "") ||
        (response.status === 401
          ? t("Войдите в аккаунт ещё раз.")
          : response.status === 403
            ? t("Недостаточно прав для этого действия.")
            : t("Не удалось выполнить запрос. Попробуйте снова.")),
    );
  }
  return response.status === 204 ? (undefined as T) : await response.json();
}
export const apiGet = <T>(path: string) => request<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
export const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
