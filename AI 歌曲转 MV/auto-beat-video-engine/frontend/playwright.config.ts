import { defineConfig, devices } from "@playwright/test";
import { resolvePlaywrightPort } from "./playwright-port";

const port = resolvePlaywrightPort(process.env.PLAYWRIGHT_PORT);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: process.env.PLAYWRIGHT_IGNORE_VISUAL === "1" ? "**/visual.spec.ts" : undefined,
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [
        ["line"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
      ]
    : "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/projects/demo/storyboard`,
    reuseExistingServer: !process.env.CI,
  },
});
