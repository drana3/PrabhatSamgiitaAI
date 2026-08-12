import { defineConfig, devices } from "@playwright/test"

const ci = Boolean(process.env.CI)
const apiServerCommand = ci
  ? ".venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8011"
  : "uv run uvicorn app.main:app --host 127.0.0.1 --port 8011"
const webServerCommand = "npm run start:standalone"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: ci ? 1 : 2,
  retries: ci ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: ci ? [["github"], ["list"]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    contextOptions: { reducedMotion: "reduce" },
    trace: ci ? "retain-on-failure" : "retain-on-failure",
    actionTimeout: 10_000,
  },
  webServer: [
    {
      command: apiServerCommand,
      cwd: "../api",
      url: "http://127.0.0.1:8011/api/v1/health/live",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        APP_ENV: "test",
        API_CORS_ORIGINS: "http://127.0.0.1:3000",
        DATABASE_URL: "postgresql+psycopg://test:test@127.0.0.1:9/test",
        LOG_LEVEL: "CRITICAL",
        SCHEDULER_ENABLED: "false",
        TRUSTED_HOSTS: "localhost,127.0.0.1,testserver,acceptance",
      },
    },
    {
      command: webServerCommand,
      url: "http://127.0.0.1:3000",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:8011",
        NEXT_PUBLIC_AUTH_ENABLED: "true",
        E2E_DISABLE_SEARCH_PREFETCH: "true",
      },
    },
  ],
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    ...(ci
      ? []
      : [{
          name: "tablet-chromium",
          use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 } },
        }]),
  ],
})
