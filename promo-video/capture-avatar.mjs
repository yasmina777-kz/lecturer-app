// Frames of avatar Alex signing the pharmacist's line (for the promo video).
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
const OUT = new URL("./build/shots/", import.meta.url).pathname;
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal", "--enable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.request.post("http://localhost:5173/api/auth/register", { data: { fullName: "Айгерим", email: `promo-${Date.now()}@example.test`, password: "Test-Pass-123" } });
await page.goto("http://localhost:5173/text-to-sign");
await page.waitForTimeout(2500);
await page.fill("textarea", "Здравствуйте! Вам помочь?");
await page.click("button:has-text('Показать жестами')");
await page.waitForTimeout(1500);
const box = await page.locator("canvas").first().boundingBox();
console.log("box", box);
for (let i = 0; i < 14; i++) {
  await page.screenshot({ path: OUT + `avatar-${i}.png`, clip: box, timeout: 15000 }).catch((e) => console.log("fail", String(e).slice(0, 120)));
  await page.waitForTimeout(500);
}
await browser.close();
