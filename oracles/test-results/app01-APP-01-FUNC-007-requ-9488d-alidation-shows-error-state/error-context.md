# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app01.spec.js >> APP-01 >> FUNC-007 required-field validation shows error state
- Location: functional/app01.spec.js:72:3

# Error details

```
TimeoutError: locator.fill: Timeout 8000ms exceeded.
Call log:
  - waiting for getByTestId('login-email')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Not Found
```

# Test source

```ts
  1  | // Shared helpers for VibeGuardBench functional specs.
  2  | export async function uiLogin(page, { email, password }, expect) {
  3  |   await page.goto("/login");
> 4  |   await page.getByTestId("login-email").fill(email);
     |                                         ^ TimeoutError: locator.fill: Timeout 8000ms exceeded.
  5  |   await page.getByTestId("login-password").fill(password);
  6  |   await page.getByTestId("login-submit").click();
  7  |   await page.waitForLoadState("networkidle");
  8  | }
  9  | 
  10 | export function marker(prefix = "vgb") {
  11 |   return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  12 | }
  13 | 
  14 | export function acceptDialogs(page) {
  15 |   page.on("dialog", (d) => d.accept().catch(() => {}));
  16 | }
  17 | 
  18 | export { test, expect } from "@playwright/test";
  19 | export { AxeBuilder } from "@axe-core/playwright";
  20 | 
```