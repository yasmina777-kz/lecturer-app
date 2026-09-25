import {
  test,
  expect,
  request as createRequest,
  type APIRequestContext,
} from "@playwright/test";
import { readFileSync } from "node:fs";
const demo = "00000000-0000-0000-0000-000000000001";
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
async function student(api: APIRequestContext, name = "Анна Студент") {
  const email = `${unique()}@test.local`;
  const response = await api.post("/api/auth/register", {
    data: { fullName: name, email, password: "Test-Pass-123", role: "Admin" },
  });
  expect(response.status()).toBe(200);
  const user = await response.json();
  expect(user.role).toBe("Student");
  return { ...user, email };
}
async function loginAdmin(api: APIRequestContext) {
  const r = await api.post("/api/auth/login", {
    data: { email: "admin@test.local", password: "Test-Only-Password-123" },
  });
  expect(r.status()).toBe(200);
  return r.json();
}

test("registration validation, normalized email, HttpOnly session and role enforcement", async ({
  request,
}) => {
  expect((await request.get("/api/lectures")).status()).toBe(401);
  const user = await student(request);
  const me = await request.get("/api/auth/me");
  expect((await me.json()).email).toBe(user.email);
  const storage = await request.storageState();
  const cookie = storage.cookies.find((c) => c.name === "lecturer_session");
  expect(cookie?.httpOnly).toBeTruthy();
  expect(cookie?.sameSite).toBe("Strict");
  expect((await request.get("/api/admin/users")).status()).toBe(403);
  expect(
    (
      await request.post("/api/auth/register", {
        data: {
          email: user.email.toUpperCase(),
          fullName: "Дубликат",
          password: "Test-Pass-123",
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post("/api/auth/register", {
        data: { email: "bad", fullName: "A", password: "x" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/auth/logout", {
        headers: { Origin: "https://evil.example" },
      })
    ).status(),
  ).toBe(403);
  await request.post("/api/auth/logout");
  expect((await request.get("/api/auth/me")).status()).toBe(401);
});

test("generation, uploads, ownership, question context, progress, quiz, and cascading deletion", async ({
  request,
  baseURL,
}) => {
  await student(request);
  const created = await request.post("/api/lectures", {
    multipart: {
      topic: "Основы обучения",
      level: "Начальный",
      durationMinutes: "5",
    },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).id;
  const l = await (await request.get(`/api/lectures/${id}`)).json();
  expect(l.slides).toHaveLength(3);
  expect(l.isPublished).toBe(false);
  const other = await createRequest.newContext({ baseURL });
  await student(other, "Другой студент");
  expect((await other.get(`/api/lectures/${id}`)).status()).toBe(404);
  expect((await other.delete(`/api/lectures/${id}`)).status()).toBe(404);
  expect(
    (
      await other.put(`/api/lectures/${id}/progress`, {
        data: { slideIndex: 0, completed: false },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await other.post("/api/questions/ask", {
        multipart: { lectureId: id, slideId: l.slides[0].id, text: "Вопрос" },
      })
    ).status(),
  ).toBe(404);
  const d = await (await request.get(`/api/lectures/${demo}`)).json();
  expect(
    (
      await request.post("/api/questions/ask", {
        multipart: { lectureId: id, slideId: d.slides[0].id, text: "Вопрос" },
      })
    ).status(),
  ).toBe(404);
  const answer = await request.post("/api/questions/ask", {
    multipart: {
      lectureId: id,
      slideId: l.slides[0].id,
      text: "Объясни принцип",
    },
  });
  expect(answer.status()).toBe(200);
  expect((await answer.json()).answerText).toContain("пример");
  const voice = await request.post("/api/questions/ask", {
    multipart: {
      lectureId: id,
      slideId: l.slides[0].id,
      audio: {
        name: "question.webm",
        mimeType: "audio/webm",
        buffer: Buffer.from("fixture audio"),
      },
    },
  });
  expect(voice.status()).toBe(200);
  expect(
    (
      await request.put(`/api/lectures/${id}/progress`, {
        data: { slideIndex: 99, completed: true },
      })
    ).status(),
  ).toBe(400);
  await request.put(`/api/lectures/${id}/progress`, {
    data: { slideIndex: 2, completed: true, notes: "Мои заметки" },
  });
  await request.put(`/api/lectures/${id}/tasks`, {
    data: { answers: { 0: "Мой пример" } },
  });
  const quiz = await request.post(`/api/lectures/${id}/quiz`, {
    data: { answers: [1] },
  });
  expect((await quiz.json()).score).toBe(100);
  const persisted = await (await request.get(`/api/lectures/${id}`)).json();
  expect(persisted.progress.completed).toBe(true);
  expect(persisted.progress.notes).toBe("Мои заметки");
  expect(persisted.progress.quizScore).toBe(100);
  expect(persisted.questions).toHaveLength(2);
  expect(JSON.parse(persisted.progress.taskAnswersJson)["0"]).toBe(
    "Мой пример",
  );
  expect(
    (
      await request.post(`/api/lectures/${id}/quiz`, { data: { answers: [] } })
    ).status(),
  ).toBe(400);
  const upload = await request.post("/api/lectures", {
    multipart: {
      level: "Начальный",
      durationMinutes: "5",
      file: {
        name: "lesson.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(
          "Учебный материал о повторении. Воспроизведение помогает проверять понимание новой темы.",
        ),
      },
    },
  });
  expect(upload.status()).toBe(201);
  expect(
    (
      await request.post("/api/lectures", {
        multipart: {
          level: "Начальный",
          durationMinutes: "5",
          file: {
            name: "bad.exe",
            mimeType: "application/octet-stream",
            buffer: Buffer.from("bad"),
          },
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/lectures", {
        multipart: {
          topic: "INVALID_RESPONSE",
          level: "Начальный",
          durationMinutes: "5",
        },
      })
    ).status(),
  ).toBe(502);
  expect((await request.delete(`/api/lectures/${id}`)).status()).toBe(204);
  expect((await request.get(`/api/lectures/${id}`)).status()).toBe(404);
  await other.dispose();
});

test("administrator roles, blocking and immediate session revocation", async ({
  request,
  baseURL,
}) => {
  const userContext = await createRequest.newContext({ baseURL });
  const user = await student(userContext);
  const admin = await loginAdmin(request);
  expect((await request.get("/api/admin/overview")).status()).toBe(200);
  expect(
    (
      await request.patch(`/api/admin/users/${admin.id}`, {
        data: { role: "Student", isDisabled: true },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.patch(`/api/admin/users/${user.id}`, {
        data: { role: "Admin", isDisabled: false },
      })
    ).status(),
  ).toBe(204);
  expect((await userContext.get("/api/auth/me")).status()).toBe(401);
  await request.patch(`/api/admin/users/${user.id}`, {
    data: { role: "Student", isDisabled: true },
  });
  expect(
    (
      await userContext.post("/api/auth/login", {
        data: { email: user.email, password: "Test-Pass-123" },
      })
    ).status(),
  ).toBe(401);
  await request.patch(`/api/admin/users/${user.id}`, {
    data: { role: "Student", isDisabled: false },
  });
  expect(
    (
      await userContext.post("/api/auth/login", {
        data: { email: user.email, password: "Test-Pass-123" },
      })
    ).status(),
  ).toBe(200);
  await userContext.dispose();
});

test("password changes revoke other sessions and preserve current session", async ({
  request,
  baseURL,
}) => {
  const user = await student(request);
  const second = await createRequest.newContext({ baseURL });
  await second.post("/api/auth/login", {
    data: { email: user.email, password: "Test-Pass-123" },
  });
  expect(
    (
      await request.post("/api/auth/password", {
        data: { currentPassword: "Wrong-Pass", newPassword: "New-Pass-123" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/auth/password", {
        data: { currentPassword: "Test-Pass-123", newPassword: "New-Pass-123" },
      })
    ).status(),
  ).toBe(204);
  expect((await second.get("/api/auth/me")).status()).toBe(401);
  expect((await request.get("/api/auth/me")).status()).toBe(200);
  await second.dispose();
});

test("UI: registration, dashboard, player, pause/question/resume, notes, quiz, settings and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Predictable speech events make the pause/resume assertion independent of installed OS voices.
  await page.addInitScript(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    (window as any).spoken = [];
    (window as any).SpeechSynthesisUtterance = class {
      text: string;
      onend?: () => void;
      constructor(text: string) {
        this.text = text;
      }
    };
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        getVoices: () => [{ name: "Yuri", lang: "ru-RU" }],
        cancel: () => clearTimeout(timer),
        speak: (u: any) => {
          (window as any).spoken.push(u.text);
          timer = setTimeout(() => u.onend?.(), 1200);
        },
      },
    });
  });
  await page.goto("/register");
  await page.getByLabel("Как вас зовут").fill("Анна");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`${unique()}@test.local`);
  await page.getByLabel("Пароль", { exact: true }).fill("Browser-Test-123");
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(
    page.getByRole("heading", { name: /Рады видеть вас, Анна/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: /Как учиться и запоминать/ }).click();
  await page.getByRole("button", { name: "Начать лекцию" }).click();
  await expect(
    page.getByRole("button", { name: "Перейти к слайдам" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Перейти к слайдам" }).click();
  await page
    .getByRole("button", { name: "Задать вопрос", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Что осталось непонятным?" }),
  ).toBeVisible();
  const before = await page.evaluate(() => (window as any).spoken.at(-1));
  await page.getByLabel("Вопрос лектору").fill("Как проверить понимание?");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Вот как это работает" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Вот как это работает" }),
  ).toBeHidden({ timeout: 10000 });
  const spoken = await page.evaluate(() => (window as any).spoken);
  expect(
    spoken.filter((s: string) => s === before).length,
  ).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page
    .getByLabel("Мои заметки", { exact: true })
    .fill("Проверить себя завтра");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("button", { name: "Сохранено" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать" }).click();
  expect((await downloadPromise).suggestedFilename()).toContain("конспект");
  await page.getByRole("button", { name: "Практика", exact: true }).click();
  await page
    .getByLabel("Объяснить идею по памяти и проверить себя", { exact: true })
    .check();
  await page
    .getByLabel("Учитывать, насколько легко вспоминается ответ", {
      exact: true,
    })
    .check();
  await page
    .getByLabel("Проверить точность и границы аналогии", { exact: true })
    .check();
  await page.getByRole("button", { name: "Проверить ответы" }).click();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Мои заметки", { exact: true })).toHaveValue(
    "Проверить себя завтра",
  );
  await page.screenshot({
    path: "test-results/player-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Настройки", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Оформление аватара" }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Безопасность" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await expect(page.getByRole("status")).toHaveText("Настройки сохранены.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Рады видеть вас, Анна/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page.getByRole("link", { name: "Мои лекции", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Мои лекции" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("UI: generate lecture and show admin controls only for administrators", async ({
  page,
}) => {
  await student(page.request, "Мария");
  await page.goto("/create");
  await page.getByLabel("Что будем изучать?").fill("Основы программирования");
  await page
    .getByRole("button", { name: "Создать лекцию", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Основы программирования", exact: true }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL("http://localhost:5173/dashboard");
  await page.request.post("/api/auth/logout");
  await loginAdmin(page.request);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Админ-панель" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Пользователи", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-desktop.png",
    fullPage: true,
  });
});

test("imports text-bearing PDF, DOCX and PPTX; rejects corrupt files", async ({
  request,
}) => {
  await student(request);
  for (const ext of ["pdf", "docx", "pptx"]) {
    const response = await request.post("/api/lectures", {
      multipart: {
        level: "Начальный",
        durationMinutes: "5",
        file: {
          name: `lesson.${ext}`,
          mimeType: "application/octet-stream",
          buffer: readFileSync(`../tests/fixtures/lesson.${ext}`),
        },
      },
    });
    expect(response.status(), await response.text()).toBe(201);
    const id = (await response.json()).id;
    expect(
      (await (await request.get(`/api/lectures/${id}`)).json()).sourceName,
    ).toBe(`lesson.${ext}`);
  }
  expect(
    (
      await request.post("/api/lectures", {
        multipart: {
          level: "Начальный",
          durationMinutes: "5",
          file: {
            name: "broken.pdf",
            mimeType: "application/pdf",
            buffer: Buffer.from("not a pdf"),
          },
        },
      })
    ).status(),
  ).toBe(400);
});
