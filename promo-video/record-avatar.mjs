// Screen-record avatar Alex signing "Здравствуйте! Вам помочь?" (cropped later with ffmpeg).
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
const DIR = new URL("./build/rec/", import.meta.url).pathname;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: DIR, size: { width: 1440, height: 900 } } });
const page = await ctx.newPage();
await page.request.post("http://localhost:5173/api/auth/register", { data: { fullName: "Айгерим", email: `promo-${Date.now()}@example.test`, password: "Test-Pass-123" } });
await page.goto("http://localhost:5173/text-to-sign");
await page.waitForTimeout(3000);
await page.fill("textarea", "Здравствуйте! Вам помочь?");
const t0 = Date.now();
await page.click("button:has-text('Показать жестами')");
await page.waitForTimeout(9000);
const box = await page.locator("canvas").first().boundingBox();
console.log(JSON.stringify({ box, clickAt: t0 }));
await ctx.close();
await browser.close();
