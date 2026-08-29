import { defineConfig, devices } from "@playwright/test";
import { resolvePlaywrightPort } from "./playwright-port";

const port = resolvePlaywrightPort(process.env.PLAYWRIGHT_PORT);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: "line",
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
    reuseExistingServer: true,
  },
});
