export type RecognitionHealth = {
  ready: boolean;
  vocabulary: number;
  error?: string;
};
export type RecognitionResult = {
  status: "draft" | "uncertain" | "no_tracking";
  text: string;
  message: string;
  seconds: number;
  tracking: {
    hands: number;
    leftHand?: number;
    rightHand?: number;
    body: number;
    face: number;
  };
};
export class RecognitionServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const ratio = (value: unknown) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;

export function parseRecognitionHealth(value: unknown): RecognitionHealth {
  if (
    !object(value) ||
    typeof value.ready !== "boolean" ||
    !Number.isSafeInteger(value.vocabulary) ||
    (value.vocabulary as number) < 0 ||
    (value.ready && value.vocabulary === 0) ||
    (value.error != null && typeof value.error !== "string")
  )
    throw new Error(
      "Некорректный ответ сервиса распознавания. Повторите проверку подключения.",
    );
  return {
    ready: value.ready,
    vocabulary: value.vocabulary as number,
    error: typeof value.error === "string" ? value.error : undefined,
  };
}

export function parseRecognitionResult(value: unknown): RecognitionResult {
  if (
    !object(value) ||
    !["draft", "uncertain", "no_tracking"].includes(value.status as string) ||
    typeof value.text !== "string" ||
    value.text.length > 4000 ||
    (value.status === "draft" ? !value.text.trim() : !!value.text.trim()) ||
    typeof value.message !== "string" ||
    !value.message.trim() ||
    typeof value.seconds !== "number" ||
    !Number.isFinite(value.seconds) ||
    value.seconds < 0 ||
    !object(value.tracking) ||
    !["hands", "body", "face"].every((key) =>
      ratio((value.tracking as Record<string, unknown>)[key]),
    ) ||
    !["leftHand", "rightHand"].every(
      (key) =>
        value.tracking &&
        ((value.tracking as Record<string, unknown>)[key] === undefined ||
          ratio((value.tracking as Record<string, unknown>)[key])),
    )
  )
    throw new Error(
      "Сервис вернул неполный результат. Текст не добавлен; попробуйте ещё раз.",
    );
  return value as RecognitionResult;
}

/** Proxy failures may be HTML or empty, not the sidecar's JSON contract. */
export async function readRecognitionResponse<T>(
  response: Response,
  parse: (value: unknown) => T,
): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      object(body) && typeof body.detail === "string"
        ? body.detail
        : response.status === 503
          ? "Сервис распознавания фраз сейчас недоступен."
          : response.status === 429
            ? "Предыдущее видео ещё обрабатывается. Подождите."
            : "Не удалось связаться с сервисом распознавания. Попробуйте снова.";
    throw new RecognitionServiceError(detail, response.status);
  }
  return parse(body);
}
