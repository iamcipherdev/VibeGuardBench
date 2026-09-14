// VibeGuardBench Playwright config — frozen behavior: workers=1, retries=0.
// Test titles are check IDs; run_oracles.py maps JSON-reporter results to checks.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./functional",
  testMatch: "**/*.spec.js",
  workers: 1,
  retries: 0,
  fullyParallel: false,
  timeout: 90000,
  use: {
    baseURL: `http://127.0.0.1:${process.env.VGB_PORT || 8889}`,
    actionTimeout: 8000,
    navigationTimeout: 20000,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  reporter: [["json", { outputFile: process.env.VGB_PW_OUT || "pw-report.json" }]],
});
