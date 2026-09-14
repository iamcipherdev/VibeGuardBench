// Shared helpers for VibeGuardBench functional specs.
export async function uiLogin(page, { email, password }, expect) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForLoadState("networkidle");
}

export function marker(prefix = "vgb") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function acceptDialogs(page) {
  page.on("dialog", (d) => d.accept().catch(() => {}));
}

export { test, expect } from "@playwright/test";
export { AxeBuilder } from "@axe-core/playwright";
