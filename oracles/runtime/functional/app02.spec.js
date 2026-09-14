// APP-02 dashboard — browser-level functional/accessibility checks.
import { test, expect, uiLogin, marker, AxeBuilder } from "../helpers.mjs";

const MEMBER = { email: "member@vgb.local", password: "member-pass-2" };

test.describe("APP-02", () => {
  test("FUNC-001 contract login flow works", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill(MEMBER.email);
    await page.getByTestId("login-password").fill("wrong-password");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-error")).toBeVisible();
    await page.getByTestId("login-password").fill(MEMBER.password);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByTestId("project-item").first()).toBeVisible();
  });

  test("FUNC-002 contract logout flow works", async ({ page }) => {
    await uiLogin(page, MEMBER);
    await page.request.post("/api/auth/logout");
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login/);
  });

  test("AUTHZ-004 admin UI denied for member", async ({ page }) => {
    await uiLogin(page, MEMBER);
    await page.goto("/admin");
    await expect(page.getByTestId("admin-user-list")).toHaveCount(0);
  });

  test("FUNC-003 create task end-to-end", async ({ page }) => {
    const m = marker("task");
    await uiLogin(page, MEMBER);
    await page.goto("/projects");
    await page.getByTestId("project-item").first().click();
    await page.getByTestId("task-new-link").click();
    await page.getByTestId("task-title").fill(`created ${m}`);
    await page.getByTestId("task-status").selectOption("doing").catch(async () => {
      await page.getByTestId("task-status").fill("doing");
    });
    await page.getByTestId("task-submit").click();
    await expect(page.getByTestId("task-item").filter({ hasText: m }).first()).toBeVisible();
  });

  test("FUNC-004 list renders created data", async ({ page }) => {
    await uiLogin(page, MEMBER);
    await page.goto("/projects");
    await page.getByTestId("project-item").first().click();
    await expect(page.getByTestId("task-item").first()).toBeVisible();
  });

  test("FUNC-005 edit flow works end-to-end", async ({ page }) => {
    await uiLogin(page, MEMBER);
    await page.goto("/projects");
    await page.getByTestId("project-item").first().click();
    const select = page.getByTestId("task-item").first().getByTestId("task-status-select");
    await select.selectOption("done").catch(async () => {
      await select.fill("done");
    });
    await page.waitForTimeout(600);
    const val = await select.inputValue().catch(() => null);
    if (val === null) throw new Error("status select missing or not a form control");
    expect(val).toBe("done");
  });

  test("FUNC-007 required-field validation shows error state", async ({ page }) => {
    await uiLogin(page, MEMBER);
    await page.goto("/projects");
    await page.getByTestId("project-item").first().click();
    await page.getByTestId("task-new-link").click();
    await page.getByTestId("task-submit").click();
    await expect(page.getByTestId("task-form-error")).toBeVisible();
  });

  test("FUNC-008 search narrows list results", async ({ page }) => {
    await uiLogin(page, MEMBER);
    await page.goto("/projects");
    await page.getByTestId("project-search").fill("Website");
    await page.waitForTimeout(600);
    const items = page.getByTestId("project-item");
    await expect(items.first()).toBeVisible();
    const count = await items.count();
    const text = await items.first().textContent();
    expect(text.toLowerCase()).toContain("website");
    expect(count).toBeLessThanOrEqual(2);
  });

  test("FUNC-009 empty list state renders", async ({ page }) => {
    await uiLogin(page, MEMBER);
    await page.goto("/projects");
    await page.getByTestId("project-search").fill(`zzz-nomatch-${marker()}`);
    await page.waitForTimeout(600);
    await expect(page.getByTestId("project-empty")).toBeVisible();
  });

  test("FUNC-010 unknown route returns not-found view", async ({ page }) => {
    await uiLogin(page, MEMBER);
    await page.goto("/nope-missing");
    await expect(page.getByTestId("not-found")).toBeVisible();
  });

  test("FUNC-011 API validation rejects malformed payloads", async ({ request }) => {
    const res = await request.post("/api/auth/login", { data: MEMBER });
    const body = await res.json();
    const token = body.token;
    const headers = token ? { authorization: `Bearer ${token}` } : undefined;
    const r1 = await request.post("/api/projects/1/tasks", { data: { status: "todo" }, headers });
    expect([400, 422]).toContain(r1.status());
  });

  test("A11Y-001 axe zero violations on login page", async ({ page }) => {
    await page.goto("/login");
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    if (res.violations.length > 0) throw new Error("axe violations: " + res.violations.map((v) => v.id).join(","));
  });

  test("A11Y-002 axe zero violations on primary list page", async ({ page }) => {
    await uiLogin(page, MEMBER);
    await page.goto("/projects");
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    if (res.violations.length > 0) throw new Error("axe violations: " + res.violations.map((v) => v.id).join(","));
  });

  test("A11Y-003 axe zero violations on form page", async ({ page }) => {
    await uiLogin(page, MEMBER);
    await page.goto("/projects");
    await page.getByTestId("project-item").first().click();
    await page.getByTestId("task-new-link").click();
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    if (res.violations.length > 0) throw new Error("axe violations: " + res.violations.map((v) => v.id).join(","));
  });

  test("A11Y-004 document language and title set", async ({ page }) => {
    await page.goto("/login");
    const lang = await page.locator("html").getAttribute("lang");
    const title = await page.title();
    expect(lang && lang.length > 0).toBeTruthy();
    expect(title && title.trim().length > 0).toBeTruthy();
  });
});
