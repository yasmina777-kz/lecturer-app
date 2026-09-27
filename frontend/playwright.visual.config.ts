import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", testMatch: "playback-theme.spec.ts", timeout: 30000, workers: 1,
  use: { baseURL: "http://localhost:5187", channel: "chrome", headless: true, viewport: { width: 1440, height: 1000 } },
  webServer: { command: "npm run dev -- --port 5187", url: "http://localhost:5187", reuseExistingServer: false },
});
