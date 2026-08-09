import { defineConfig, devices } from "@playwright/test";

const frontendPort = process.env.PLAYWRIGHT_PORT ?? "3000";
const apiPort = process.env.PLAYWRIGHT_API_PORT ?? "8000";
const localBaseURL = `http://127.0.0.1:${frontendPort}`;
const localApiURL = `http://127.0.0.1:${apiPort}`;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? localBaseURL;
const useLocalServers = !process.env.PLAYWRIGHT_BASE_URL;
const python = process.env.E2E_PYTHON ?? "../.venv/bin/python";
const databaseUrl = process.env.E2E_DATABASE_URL ?? "";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: useLocalServers
    ? [
        {
          command: `cd ../nzeroesg-api && APP_ENV=development DATABASE_URL=${databaseUrl} CORS_ORIGINS=${localBaseURL} ${python} -m uvicorn main:app --host 127.0.0.1 --port ${apiPort}`,
          url: `${localApiURL}/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: `NEXT_PUBLIC_BACKEND_URL=${localApiURL} npm run dev -- --hostname 127.0.0.1 --port ${frontendPort}`,
          url: `${localBaseURL}/login`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ]
    : undefined,
});
