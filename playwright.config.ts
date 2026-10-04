import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests for critical offline/PWA flows (PWA-005). They need a production
 * build (the service worker is disabled in `next dev`): run `npm run test:e2e`.
 * Browser: Playwright's Chromium (`npx playwright install chromium`), or an installed
 * Chrome with PLAYWRIGHT_CHANNEL=chrome.
 */
const PORT = 3200;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  // The tests share one server; offline state is per browser context.
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-US",
    timezoneId: "Europe/Zurich",
    serviceWorkers: "allow",
  },
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
