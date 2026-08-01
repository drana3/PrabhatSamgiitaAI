import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "uv run uvicorn app.main:app --host 127.0.0.1 --port 8011",
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
      command: "npm run build && npm run start",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:8011",
      },
    },
  ],
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "tablet-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 } } },
  ],
})
