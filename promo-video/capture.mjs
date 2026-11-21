// Screenshots of the running local platform for the promo video.
//   node promo-video/capture.mjs   (frontend on :5173, backend on :5050)
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
const OUT = new URL("./build/shots/", import.meta.url).pathname;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.request.post("http://localhost:5173/api/auth/register", { data: { fullName: "Айгерим", email: `promo-${Date.now()}@example.test`, password: "Test-Pass-123" } });
const shot = async (url, name, wait = 3000, act) => {
  await page.goto("http://localhost:5173" + url);
  await page.waitForTimeout(wait);
  if (act) await act();
  await page.screenshot({ path: OUT + name + ".png" });
  console.log("shot", name);
};
await shot("/learn", "learn");
await shot("/vocab", "vocab");
await shot("/practice", "practice");
await shot("/grammar?track=rsl&lesson=two-forms", "grammar", 4000);
await shot("/text-to-sign", "translate", 2500, async () => {
  await page.fill("textarea", "Здравствуйте! Чем вам помочь?");
  await page.click("button:has-text('Показать жестами')");
  await page.waitForTimeout(2600);
});
const stage = page.locator(".human-stage").first();
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(450);
  await stage.screenshot({ path: OUT + `avatar-${i}.png` }).catch(() => {});
}
await browser.close();
