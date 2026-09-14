// APP-01 booking — browser-level functional/accessibility checks.
// Test titles are check IDs (parsed by run_oracles.py).
import { test, expect, uiLogin, marker, acceptDialogs, AxeBuilder } from "../helpers.mjs";

const PATIENT = { email: "patient@vgb.local", password: "patient-pass-1" };
const ADMIN = { email: "admin@vgb.local", password: "admin-pass-9" };

test.describe("APP-01", () => {
  test("FUNC-001 contract login flow works", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill(PATIENT.email);
    await page.getByTestId("login-password").fill("wrong-password");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-error")).toBeVisible();
    await page.getByTestId("login-password").fill(PATIENT.password);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/appointments/);
  });

  test("FUNC-002 contract logout flow works", async ({ page }) => {
    await uiLogin(page, PATIENT);
    await page.request.post("/api/auth/logout");
    await page.goto("/appointments");
    await expect(page).toHaveURL(/\/login/);
  });

  test("AUTHZ-004 admin UI denied for patient", async ({ page }) => {
    await uiLogin(page, PATIENT);
    await page.goto("/admin");
    await expect(page.getByTestId("admin-appointment-count")).toHaveCount(0);
  });

  test("FUNC-003 create appointment end-to-end", async ({ page }) => {
    await uiLogin(page, PATIENT);
    await page.goto("/appointments");
    await page.getByTestId("appt-new-link").click();
    await page.getByTestId("appt-date").fill("2031-03-03");
    await page.getByTestId("appt-time").fill("11:15");
    await page.getByTestId("appt-reason").fill(`ui-create ${marker()}`);
    await page.getByTestId("appt-submit").click();
    await expect(page).toHaveURL(/\/appointments/);
    await expect(page.getByTestId("appt-list")).toBeVisible();
  });

  test("FUNC-004 list renders created data", async ({ page }) => {
    await uiLogin(page, PATIENT);
    await page.goto("/appointments");
    const item = page.getByTestId("appt-item").first();
    await expect(item).toBeVisible();
    await expect(item).toContainText(/\d{4}-\d{2}-\d{2}/);
  });

  test("FUNC-006 delete own appointment end-to-end", async ({ page }) => {
    // self-sufficient: create one appointment via API, then delete via UI
    const login = await page.request.post("/api/auth/login", { data: PATIENT });
    const body = await login.json();
    const headers = body.token ? { authorization: `Bearer ${body.token}` } : undefined;
    await page.request.post("/api/appointments", {
      data: { date: "2031-06-06", time: "09:45", reason: `delete-target-${marker()}` }, headers,
    });
    await uiLogin(page, PATIENT);
    await page.goto("/appointments");
    acceptDialogs(page);
    const before = await page.getByTestId("appt-item").count();
    test.skip(before === 0, "no items to delete (create failure cascades)");
    await page.getByTestId("appt-item").first().getByTestId("appt-delete").click();
    await page.waitForTimeout(800);
    const after = await page.getByTestId("appt-item").count();
    expect(after).toBeLessThan(before);
  });

  test("FUNC-007 required-field validation shows error state", async ({ page }) => {
    await uiLogin(page, PATIENT);
    await page.goto("/appointments/new");
    await page.getByTestId("appt-submit").click();
    await expect(page.getByTestId("appt-form-error")).toBeVisible();
  });

  test("FUNC-008 search narrows list results", async ({ page }) => {
    const m = marker("srch");
    await uiLogin(page, PATIENT);
    await page.goto("/appointments/new");
    await page.getByTestId("appt-date").fill("2031-04-04");
    await page.getByTestId("appt-time").fill("12:30");
    await page.getByTestId("appt-reason").fill(`searchable ${m} unique`);
    await page.getByTestId("appt-submit").click();
    await page.goto("/appointments");
    await page.getByTestId("appt-search").fill(m);
    await page.waitForTimeout(600);
    await expect(page.getByTestId("appt-item").first()).toContainText(m);
  });

  test("FUNC-009 empty list state renders", async ({ page }) => {
    await uiLogin(page, PATIENT);
    await page.goto("/appointments");
    await page.getByTestId("appt-search").fill(`zzz-nomatch-${marker()}`);
    await page.waitForTimeout(600);
    await expect(page.getByTestId("appt-empty")).toBeVisible();
  });

  test("FUNC-010 unknown route returns not-found view", async ({ page }) => {
    await uiLogin(page, PATIENT);
    await page.goto("/nope-missing");
    await expect(page.getByTestId("not-found")).toBeVisible();
  });

  test("FUNC-011 API validation rejects malformed payloads", async ({ request }) => {
    // login via API to get session
    const res = await request.post("/api/auth/login", { data: PATIENT });
    const body = await res.json();
    const token = body.token;
    const headers = token ? { authorization: `Bearer ${token}` } : undefined;
    const r1 = await request.post("/api/appointments", { data: { date: "2031-05-05" }, headers });
    expect([400, 422]).toContain(r1.status());
    const r2 = await request.post("/api/appointments", { data: { date: "2031-05-05", time: "10:00", reason: "" }, headers });
    expect([400, 422]).toContain(r2.status());
  });

  test("A11Y-001 axe zero violations on login page", async ({ page }) => {
    await page.goto("/login");
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    if (res.violations.length > 0) {
      throw new Error("axe violations: " + res.violations.map((v) => v.id).join(","));
    }
  });

  test("A11Y-002 axe zero violations on primary list page", async ({ page }) => {
    await uiLogin(page, PATIENT);
    await page.goto("/appointments");
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    if (res.violations.length > 0) {
      throw new Error("axe violations: " + res.violations.map((v) => v.id).join(","));
    }
  });

  test("A11Y-003 axe zero violations on form page", async ({ page }) => {
    await uiLogin(page, PATIENT);
    await page.goto("/appointments/new");
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    if (res.violations.length > 0) {
      throw new Error("axe violations: " + res.violations.map((v) => v.id).join(","));
    }
  });

  test("A11Y-004 document language and title set", async ({ page }) => {
    await page.goto("/login");
    const lang = await page.locator("html").getAttribute("lang");
    const title = await page.title();
    expect(lang && lang.length > 0).toBeTruthy();
    expect(title && title.trim().length > 0).toBeTruthy();
  });
});
