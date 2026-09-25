import { test, expect, request as requests } from "@playwright/test";
const unique = () =>
  `teacher-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`;
test("teacher registration, validation, lesson settings snapshot and multilingual AI requests", async ({
  request,
  baseURL,
}) => {
  const payload = {
    email: unique(),
    password: "Teaching-Test-123",
    fullName: "Test Teacher",
    accountType: "Lecturer",
    interfaceLanguage: "kk",
    teachingLanguage: "kk",
    avatarId: "classic-female",
    voiceGender: "female",
  };
  const elevated = await request.post("/api/auth/register", {
    data: { ...payload, email: unique(), accountType: "Admin" },
  });
  expect((await elevated.json()).role).toBe("Student");
  expect(
    (
      await request.post("/api/auth/register", {
        data: { ...payload, avatarId: "ueavatar" },
      })
    ).status(),
  ).toBe(400);
  const registered = await request.post("/api/auth/register", {
    data: payload,
  });
  expect(registered.status()).toBe(200);
  expect(await registered.json()).toMatchObject({
    role: "Student",
    interfaceLanguage: "kk",
    teachingLanguage: "kk",
    avatarId: "classic-female",
    voiceGender: "female",
  });
  expect((await request.get("/api/admin/users")).status()).toBe(403);
  const admin = await requests.newContext({ baseURL });
  await admin.post("/api/auth/login", {
    data: { email: "admin@test.local", password: "Test-Only-Password-123" },
  });
  const uid = (await registered.json()).id;
  expect(
    (
      await admin.patch(`/api/admin/users/${uid}`, {
        data: { role: "Lecturer", isDisabled: false },
      })
    ).status(),
  ).toBe(204);
  expect((await request.get("/api/auth/me")).status()).toBe(401);
  await request.post("/api/auth/login", {
    data: { email: payload.email, password: payload.password },
  });
  await admin.dispose();
  for (const language of ["kk", "en"]) {
    const created = await request.post("/api/lectures", {
      multipart: {
        topic: "Learning skills",
        level: "Начальный",
        durationMinutes: "5",
        language,
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const id = (await created.json()).id;
    const lesson = await (await request.get(`/api/lectures/${id}`)).json();
    expect(lesson).toMatchObject({
      language,
      avatarId: "classic-female",
      voiceGender: "female",
      avatarStyle: "sage",
    });
    expect(lesson.summary).toBe(
      language === "kk" ? "Білімді тексеру" : "Check understanding",
    );
    const answer = await request.post("/api/questions/ask", {
      multipart: {
        lectureId: id,
        slideId: lesson.slides[0].id,
        text: "Explain",
      },
    });
    expect((await answer.json()).answerText).toBe(
      language === "kk"
        ? "Мысал арқылы түсіндірейік."
        : "Let us explain with an example.",
    );
    expect(
      (
        await request.patch(`/api/lectures/${id}`, {
          data: { title: lesson.title, isPublished: true },
        })
      ).status(),
    ).toBe(204);
    const reader = await requests.newContext({ baseURL });
    await reader.post("/api/auth/register", {
      data: {
        email: unique(),
        password: "Teaching-Test-123",
        fullName: "Reader",
        avatarId: "classic-male",
        voiceGender: "male",
        interfaceLanguage: "ru",
        teachingLanguage: "ru",
      },
    });
    expect(
      await (await reader.get(`/api/lectures/${id}`)).json(),
    ).toMatchObject({
      avatarId: "classic-female",
      voiceGender: "female",
      language,
    });
    await reader.dispose();
    if (language === "en") {
      expect(
        (
          await request.patch("/api/auth/me", {
            data: {
              fullName: "Test Teacher",
              avatarStyle: "ocean",
              speechRate: 1,
              avatarId: "classic-female",
              voiceGender: "male",
              teachingLanguage: "ru",
            },
          })
        ).status(),
      ).toBe(200);
      expect(
        await (await request.get(`/api/lectures/${id}`)).json(),
      ).toMatchObject({
        avatarId: "classic-female",
        voiceGender: "female",
        language: "en",
        avatarStyle: "sage",
      });
    }
  }
  expect(
    (
      await request.patch("/api/auth/language", { data: { language: "xx" } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.patch("/api/auth/language", { data: { language: "en" } })
    ).status(),
  ).toBe(200);
  expect(
    (await (await request.get("/api/auth/me")).json()).interfaceLanguage,
  ).toBe("en");
  expect(
    (
      await request.post("/api/speech", {
        data: { text: "Hello", language: "en", gender: "female" },
      })
    ).status(),
  ).toBe(503);
  expect(
    (
      await request.post("/api/speech", {
        data: { text: "Hello", language: "xx", gender: "female" },
      })
    ).status(),
  ).toBe(400);
});

test("student onboarding, multilingual settings and simplified mobile UI", async ({
  page,
}) => {
  await page.goto("/register?role=teacher");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Teacher", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Your name", { exact: true }).fill("Aigerim");
  await page.getByLabel("Email", { exact: true }).fill(unique());
  await page.getByLabel("Password", { exact: true }).fill("Teaching-Test-123");
  await page.screenshot({
    path: "test-results/student-registration-en.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard$/);
  expect((await (await page.request.get("/api/auth/me")).json()).role).toBe(
    "Student",
  );
  await expect(
    page
      .locator(".sidebar")
      .getByRole("link", { name: "Create lecture", exact: true }),
  ).toHaveCount(0);
  await page.goto("/settings");
  await page.getByRole("button", { name: /Classic female lecturer/ }).click();
  await page.getByLabel("Teaching language").selectOption("kk");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.getByRole("button", { name: "KZ", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Оқыту тілі")).toHaveValue("kk");
  await expect(page.getByLabel("Оқытушының дауысы")).toHaveValue("female");
  await expect(
    page.locator(".female-avatar [data-hair=male-front]"),
  ).toHaveCount(0);
  await expect(
    page.locator(".female-avatar [data-hair=male-back]"),
  ).toHaveCount(0);
  await expect(page.locator(".avatar-options, .password-panel")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/teacher-settings-kk-mobile.png",
    fullPage: true,
  });
});
