// APP-03 inventory — browser-level functional/accessibility checks.
import { test, expect, uiLogin, marker, acceptDialogs, AxeBuilder } from "../helpers.mjs";

const STAFF = { email: "staff@vgb.local", password: "staff-pass-1" };
const MANAGER = { email: "manager@vgb.local", password: "manager-pass-8" };

test.describe("APP-03", () => {
  test("FUNC-001 contract login flow works", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill(STAFF.email);
    await page.getByTestId("login-password").fill("wrong-password");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-error")).toBeVisible();
    await page.getByTestId("login-password").fill(STAFF.password);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/products/);
    await expect(page.getByTestId("product-item")).toHaveCount(3);
  });

  test("FUNC-002 contract logout flow works", async ({ page }) => {
    await uiLogin(page, STAFF);
    await page.request.post("/api/auth/logout");
    await page.goto("/products");
    await expect(page).toHaveURL(/\/login/);
  });

  test("AUTHZ-004 inventory UI denied for staff", async ({ page }) => {
    await uiLogin(page, STAFF);
    await page.goto("/inventory");
    await expect(page.getByTestId("inventory-list")).toHaveCount(0);
  });

  test("FUNC-003 order flow works end-to-end (create)", async ({ page }) => {
    await uiLogin(page, STAFF);
    await page.goto("/products");
    const widget = page.getByTestId("product-item").filter({ hasText: "W-001" }).first();
    await widget.getByTestId("product-order-link").click();
    await page.getByTestId("order-qty").fill("2");
    await page.getByTestId("order-submit").click();
    await expect(page.getByTestId("order-success")).toBeVisible();
    await page.goto("/products");
    await expect(page.getByTestId("product-item").filter({ hasText: "W-001" }).first()).toContainText("8");
  });

  test("FUNC-004 list renders created data", async ({ page }) => {
    await uiLogin(page, STAFF);
    await page.goto("/products");
    await expect(page.getByTestId("product-item").first()).toBeVisible();
    await expect(page.getByTestId("product-item").first()).toContainText(/\d+\.\d{2}/);
  });

  test("FUNC-005 edit flow works end-to-end (stock update, manager)", async ({ page }) => {
    await uiLogin(page, MANAGER);
    await page.goto("/inventory");
    const first = page.getByTestId("inventory-item").first();
    await first.getByTestId("inventory-stock-input").fill("12");
    await first.getByTestId("inventory-save").click();
    await page.waitForTimeout(800);
    await page.goto("/products");
    const gadget = page.getByTestId("product-item").filter({ hasText: "W-001" }).first();
    await expect(gadget).toContainText("12");
  });

  test("FUNC-007 required-field validation shows error state", async ({ page }) => {
    await uiLogin(page, STAFF);
    await page.goto("/products");
    await page.getByTestId("product-item").filter({ hasText: "W-001" }).first()
      .getByTestId("product-order-link").click();
    await page.getByTestId("order-qty").fill("0");
    await page.getByTestId("order-submit").click();
    await expect(page.getByTestId("order-form-error")).toBeVisible();
  });

  test("FUNC-008 search narrows list results", async ({ page }) => {
    await uiLogin(page, STAFF);
    await page.goto("/products");
    await page.getByTestId("product-search").fill("W-001");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("product-item")).toHaveCount(1);
  });

  test("FUNC-009 empty list state renders", async ({ page }) => {
    await uiLogin(page, STAFF);
    await page.goto("/products");
    await page.getByTestId("product-search").fill(`zzz-nomatch-${marker()}`);
    await page.waitForTimeout(600);
    await expect(page.getByTestId("product-empty")).toBeVisible();
  });

  test("FUNC-010 unknown route returns not-found view", async ({ page }) => {
    await uiLogin(page, STAFF);
    await page.goto("/nope-missing");
    await expect(page.getByTestId("not-found")).toBeVisible();
  });

  test("FUNC-011 API validation rejects malformed payloads", async ({ request }) => {
    const res = await request.post("/api/auth/login", { data: STAFF });
    const body = await res.json();
    const token = body.token;
    const headers = token ? { authorization: `Bearer ${token}` } : undefined;
    const products = await request.get("/api/products", { headers });
    const list = (await products.json()).products || [];
    const wid = list.find((p) => p.sku === "W-001").id;
    const r1 = await request.post(`/api/products/${wid}/order`, { data: { qty: 0 }, headers });
    expect([400, 422]).toContain(r1.status());
    const r2 = await request.post(`/api/products/${wid}/order`, { data: { qty: 1.5 }, headers });
    expect([400, 422]).toContain(r2.status());
  });

  test("A11Y-001 axe zero violations on login page", async ({ page }) => {
    await page.goto("/login");
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    if (res.violations.length > 0) throw new Error("axe violations: " + res.violations.map((v) => v.id).join(","));
  });

  test("A11Y-002 axe zero violations on primary list page", async ({ page }) => {
    await uiLogin(page, STAFF);
    await page.goto("/products");
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    if (res.violations.length > 0) throw new Error("axe violations: " + res.violations.map((v) => v.id).join(","));
  });

  test("A11Y-003 axe zero violations on form page", async ({ page }) => {
    await uiLogin(page, STAFF);
    await page.goto("/products");
    await page.getByTestId("product-item").filter({ hasText: "W-001" }).first()
      .getByTestId("product-order-link").click();
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
