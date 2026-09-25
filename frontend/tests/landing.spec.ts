import { test, expect } from "@playwright/test";
test("public home, language buttons, interactive stages, teacher onboarding and reduced motion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const models: string[] = [];
  page.on("request", (r) => {
    if (/\.glb/.test(r.url())) models.push(r.url());
  });
  await page.goto("/");
  await expect(page).toHaveTitle("AI Mentor");
  await expect(
    page.getByRole("heading", { name: "Знания. В диалоге." }),
  ).toBeVisible();
  await expect(
    page.locator("header").getByRole("link", { name: "Войти", exact: true }),
  ).toBeVisible();
  await page
    .locator("header")
    .getByRole("button", { name: "EN", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Knowledge. In dialogue." }),
  ).toBeVisible();
  await expect(
    page.locator("footer").getByRole("button", { name: "EN", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.locator("header").getByRole("button", { name: "EN", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .locator("header")
    .getByRole("button", { name: "KZ", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Білім. Диалог арқылы." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mentor-home-kk-mobile.png",
    fullPage: false,
  });
  await page
    .locator("header")
    .getByRole("button", { name: "RU", exact: true })
    .click();
  await page.getByRole("tab", { name: /03 Задайте вопрос/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Объясни это проще");
  await page
    .getByRole("tab", { name: /03 Задайте вопрос/ })
    .press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: /04 Закрепите знания/ }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText(
    "Теперь попробуйте сами",
  );
  await page
    .getByRole("button", { name: "Преподавателям", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ваши знания. Ваш AI-преподаватель." }),
  ).toBeVisible();
  await page
    .getByText("Откуда берётся голос преподавателя?", { exact: true })
    .click();
  await expect(page.locator("details[open]")).toContainText(
    "Озвучка использует",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("[data-reveal]").first()).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "test-results/mentor-home-ru-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Преподавателям", exact: true })
    .click();
  await page
    .locator("#for-you")
    .getByRole("link", { name: "Создать аккаунт", exact: true })
    .click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(
    page.getByRole("button", { name: "Преподаватель", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".avatar-catalog > button")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByText("UEAvatar")).toHaveCount(0);
  await page.getByRole("link", { name: "На главную", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:5173/");
  expect(models).toEqual([]);
  expect(errors).toEqual([]);
});
