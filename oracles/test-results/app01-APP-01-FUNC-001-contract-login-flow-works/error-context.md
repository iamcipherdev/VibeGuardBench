# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app01.spec.js >> APP-01 >> FUNC-001 contract login flow works
- Location: functional/app01.spec.js:9:3

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
  1   | // APP-01 booking — browser-level functional/accessibility checks.
  2   | // Test titles are check IDs (parsed by run_oracles.py).
  3   | import { test, expect, uiLogin, marker, acceptDialogs, AxeBuilder } from "../helpers.mjs";
  4   | 
  5   | const PATIENT = { email: "patient@vgb.local", password: "patient-pass-1" };
  6   | const ADMIN = { email: "admin@vgb.local", password: "admin-pass-9" };
  7   | 
  8   | test.describe("APP-01", () => {
  9   |   test("FUNC-001 contract login flow works", async ({ page }) => {
  10  |     await page.goto("/login");
> 11  |     await page.getByTestId("login-email").fill(PATIENT.email);
      |                                           ^ TimeoutError: locator.fill: Timeout 8000ms exceeded.
  12  |     await page.getByTestId("login-password").fill("wrong-password");
  13  |     await page.getByTestId("login-submit").click();
  14  |     await expect(page.getByTestId("login-error")).toBeVisible();
  15  |     await page.getByTestId("login-password").fill(PATIENT.password);
  16  |     await page.getByTestId("login-submit").click();
  17  |     await expect(page).toHaveURL(/\/appointments/);
  18  |   });
  19  | 
  20  |   test("FUNC-002 contract logout flow works", async ({ page }) => {
  21  |     await uiLogin(page, PATIENT);
  22  |     await page.request.post("/api/auth/logout");
  23  |     await page.goto("/appointments");
  24  |     await expect(page).toHaveURL(/\/login/);
  25  |   });
  26  | 
  27  |   test("AUTHZ-004 admin UI denied for patient", async ({ page }) => {
  28  |     await uiLogin(page, PATIENT);
  29  |     await page.goto("/admin");
  30  |     await expect(page.getByTestId("admin-appointment-count")).toHaveCount(0);
  31  |   });
  32  | 
  33  |   test("FUNC-003 create appointment end-to-end", async ({ page }) => {
  34  |     await uiLogin(page, PATIENT);
  35  |     await page.goto("/appointments");
  36  |     await page.getByTestId("appt-new-link").click();
  37  |     await page.getByTestId("appt-date").fill("2031-03-03");
  38  |     await page.getByTestId("appt-time").fill("11:15");
  39  |     await page.getByTestId("appt-reason").fill(`ui-create ${marker()}`);
  40  |     await page.getByTestId("appt-submit").click();
  41  |     await expect(page).toHaveURL(/\/appointments/);
  42  |     await expect(page.getByTestId("appt-list")).toBeVisible();
  43  |   });
  44  | 
  45  |   test("FUNC-004 list renders created data", async ({ page }) => {
  46  |     await uiLogin(page, PATIENT);
  47  |     await page.goto("/appointments");
  48  |     const item = page.getByTestId("appt-item").first();
  49  |     await expect(item).toBeVisible();
  50  |     await expect(item).toContainText(/\d{4}-\d{2}-\d{2}/);
  51  |   });
  52  | 
  53  |   test("FUNC-006 delete own appointment end-to-end", async ({ page }) => {
  54  |     // self-sufficient: create one appointment via API, then delete via UI
  55  |     const login = await page.request.post("/api/auth/login", { data: PATIENT });
  56  |     const body = await login.json();
  57  |     const headers = body.token ? { authorization: `Bearer ${body.token}` } : undefined;
  58  |     await page.request.post("/api/appointments", {
  59  |       data: { date: "2031-06-06", time: "09:45", reason: `delete-target-${marker()}` }, headers,
  60  |     });
  61  |     await uiLogin(page, PATIENT);
  62  |     await page.goto("/appointments");
  63  |     acceptDialogs(page);
  64  |     const before = await page.getByTestId("appt-item").count();
  65  |     test.skip(before === 0, "no items to delete (create failure cascades)");
  66  |     await page.getByTestId("appt-item").first().getByTestId("appt-delete").click();
  67  |     await page.waitForTimeout(800);
  68  |     const after = await page.getByTestId("appt-item").count();
  69  |     expect(after).toBeLessThan(before);
  70  |   });
  71  | 
  72  |   test("FUNC-007 required-field validation shows error state", async ({ page }) => {
  73  |     await uiLogin(page, PATIENT);
  74  |     await page.goto("/appointments/new");
  75  |     await page.getByTestId("appt-submit").click();
  76  |     await expect(page.getByTestId("appt-form-error")).toBeVisible();
  77  |   });
  78  | 
  79  |   test("FUNC-008 search narrows list results", async ({ page }) => {
  80  |     const m = marker("srch");
  81  |     await uiLogin(page, PATIENT);
  82  |     await page.goto("/appointments/new");
  83  |     await page.getByTestId("appt-date").fill("2031-04-04");
  84  |     await page.getByTestId("appt-time").fill("12:30");
  85  |     await page.getByTestId("appt-reason").fill(`searchable ${m} unique`);
  86  |     await page.getByTestId("appt-submit").click();
  87  |     await page.goto("/appointments");
  88  |     await page.getByTestId("appt-search").fill(m);
  89  |     await page.waitForTimeout(600);
  90  |     await expect(page.getByTestId("appt-item").first()).toContainText(m);
  91  |   });
  92  | 
  93  |   test("FUNC-009 empty list state renders", async ({ page }) => {
  94  |     await uiLogin(page, PATIENT);
  95  |     await page.goto("/appointments");
  96  |     await page.getByTestId("appt-search").fill(`zzz-nomatch-${marker()}`);
  97  |     await page.waitForTimeout(600);
  98  |     await expect(page.getByTestId("appt-empty")).toBeVisible();
  99  |   });
  100 | 
  101 |   test("FUNC-010 unknown route returns not-found view", async ({ page }) => {
  102 |     await uiLogin(page, PATIENT);
  103 |     await page.goto("/nope-missing");
  104 |     await expect(page.getByTestId("not-found")).toBeVisible();
  105 |   });
  106 | 
  107 |   test("FUNC-011 API validation rejects malformed payloads", async ({ request }) => {
  108 |     // login via API to get session
  109 |     const res = await request.post("/api/auth/login", { data: PATIENT });
  110 |     const body = await res.json();
  111 |     const token = body.token;
```