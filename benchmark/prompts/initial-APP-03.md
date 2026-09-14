# Initial Generation Prompt — APP-03 Inventory (FROZEN v1.0.0)

Delivered verbatim to each builder (platform-imposed deviations logged).

---

Build a complete ordering and inventory web application for a single shop. It must be a
full-stack application: frontend UI, backend API, and a persistent server-side database
(not in-memory). Export/produce the full source code so it can be installed and run
locally.

Roles and seeded accounts (create on first start):
- staff: staff@vgb.local / staff-pass-1
- manager: manager@vgb.local / manager-pass-8

Seed data: 3 products — Widget (SKU W-001, price 9.99, stock 10), Gadget (G-002, 19.99,
5), Doohickey (D-003, 4.99, stock 0).

Pages and behavior:
- /login — login form. data-testid: login-email, login-password, login-submit,
  login-error. On success go to /products.
- /products — product list showing name, SKU, price, stock. data-testid: product-list,
  product-item, product-search, product-empty, product-order-link. Search narrows by
  name or SKU.
- /products/{id}/order — order form with quantity. data-testid: order-qty, order-submit,
  order-form-error, order-success. Placing a valid order decrements stock, shows
  order-success, and records the order. qty must be an integer >= 1 and <= stock;
  violations show order-form-error and create nothing.
- /inventory — manager-only page listing products with editable stock inputs.
  data-testid: inventory-list, inventory-item, inventory-stock-input, inventory-save.
  Saving persists the new stock.
- Unknown paths show a not-found view, data-testid: not-found.

API contract (must match exactly):
- POST /api/auth/login {email, password} → 200 {token, role} | 401
- POST /api/auth/logout → 204 (session invalid afterwards)
- GET /api/products → 200 {products: [{id, name, sku, price, stock}]} | 401
- POST /api/products/{id}/order {qty} → 201 {order} where order = {id, productId, qty};
  stock decrements | 400 when qty < 1, non-integer, or qty > stock | 401
- PATCH /api/products/{id} {stock} → manager only, 200 {product} | 403 staff |
  400 non-integer stock
- DELETE /api/products/{id} → manager only, 204 | 403 staff | 404

Security requirements:
- Everything except /login and /api/auth/login requires a session.
- Staff must get 403 on PATCH and DELETE of products and must not reach /inventory.
- Logout must invalidate the session.
- Cookies must be HttpOnly and SameSite if used; tokens must not be stored in
  localStorage (sessionStorage or cookie instead).
- Hash passwords; no plaintext storage.
- No hard-coded secrets; no debug/test endpoints.

Quality requirements:
- Accessibility: zero axe-core violations (WCAG 2.1 A/AA) on /login, /products, and
  /products/{id}/order. Set html lang and a non-empty title on every page.
- Persistence: orders, stock updates, and deletions survive an application restart.
- TypeScript must compile with tsc --noEmit if used. ESLint clean. Build must succeed;
  start command serves on PORT.
