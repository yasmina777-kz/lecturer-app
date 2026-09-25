import { test, expect, request as requests } from "@playwright/test";
const password = "Test-Only-Password-123";
test("duration generation, illustrated slides, usage accuracy, failures and admin-only reports", async ({
  page,
  baseURL,
}) => {
  const userResponse = await page.request.post("/api/auth/register", {
    data: {
      email: `usage-${Date.now()}@test.local`,
      password,
      fullName: "Usage Student",
      accountType: "Lecturer",
    },
  });
  expect((await userResponse.json()).role).toBe("Student");
  expect((await page.request.get("/api/admin/usage")).status()).toBe(403);
  expect(
    (
      await page.request.post("/api/lectures", {
        multipart: { topic: "Invalid duration", durationMinutes: "60" },
      })
    ).status(),
  ).toBe(400);
  await page.goto("/create");
  await page.getByLabel("Длительность лекции").selectOption("20");
  await page.getByLabel("Что будем изучать?").fill("Illustrated learning");
  await page
    .getByRole("button", { name: "Создать лекцию", exact: true })
    .click();
  await expect(page).toHaveURL(/\/lectures\//);
  const id = page.url().split("/").pop();
  const lesson = await (await page.request.get(`/api/lectures/${id}`)).json();
  expect(lesson.targetMinutes).toBe(20);
  expect(lesson.estimatedMinutes).toBeGreaterThan(18);
  expect(lesson.estimatedMinutes).toBeLessThan(22);
  expect(lesson.slides).toHaveLength(10);
  expect(JSON.parse(lesson.slides[0].contentJson).visual.items).toHaveLength(2);
  await page
    .getByRole("button", { name: "Начать лекцию", exact: true })
    .click();
  await page.getByRole("button", { name: "Перейти к слайдам" }).click();
  await expect(page.locator(".teaching-visual")).toBeVisible();
  await page.screenshot({
    path: "test-results/illustrated-lecture.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/illustrated-lecture-mobile.png",
    fullPage: true,
  });
  const admin = await requests.newContext({ baseURL });
  await admin.post("/api/auth/login", {
    data: { email: "admin@test.local", password },
  });
  const report = await (
    await admin.get("/api/admin/usage?operation=lecture_slides")
  ).json();
  const rows = report.rows.filter((r: any) => r.lectureId === id);
  expect(rows).toHaveLength(4);
  for (const r of rows) {
    expect(r.inputTokens).toBe(1000);
    expect(r.cachedTokens).toBe(200);
    expect(r.outputTokens).toBe(500);
    expect(r.estimatedUsd).toBeCloseTo(0.000435, 8);
    expect(r.status).toBe("success");
  }
  for (const topic of [
    "INVALID_RESPONSE",
    "PROVIDER_FAILURE",
    "MISSING_USAGE",
  ]) {
    const response = await page.request.post("/api/lectures", {
      multipart: { topic, durationMinutes: "5" },
    });
    expect(response.status()).toBe(topic === "MISSING_USAGE" ? 201 : 502);
  }
  const after = await (await admin.get("/api/admin/usage")).json();
  expect(
    after.rows.some(
      (r: any) => r.status === "invalid_response" && r.inputTokens === 1000,
    ),
  ).toBe(true);
  expect(
    after.rows.some(
      (r: any) =>
        r.status === "provider_error" &&
        r.inputTokens === null &&
        r.estimatedUsd === null,
    ),
  ).toBe(true);
  expect(
    after.rows.some(
      (r: any) =>
        r.status === "success" &&
        r.inputTokens === null &&
        r.estimatedUsd === null,
    ),
  ).toBe(true);
  await page.request.delete(`/api/lectures/${id}`);
  const preserved = await (await admin.get("/api/admin/usage")).json();
  expect(preserved.rows.filter((r: any) => r.lectureId === id).length).toBe(5);
  await page.request.post("/api/auth/logout");
  await page.request.post("/api/auth/login", {
    data: { email: "admin@test.local", password },
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Расход AI", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Журнал запросов" }),
  ).toBeVisible();
  await expect(page.getByText("Usage Student").first()).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-ai-usage.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await admin.dispose();
});
