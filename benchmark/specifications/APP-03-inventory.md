# APP-03 — Ordering / Inventory Application (Frozen Specification v1.0.0)

Frozen 2026-09-14. Part of VibeGuardBench. Changes after data collection begin require
a protocol amendment.

## 1. Overview

An inventory-and-ordering application for a single shop. Two roles:

- `staff` — browses the catalog, places orders, updates stock counts.
- `manager` — additionally accesses the inventory admin page and can delete products.

Seed accounts:

| Role | Email | Password |
|---|---|---|
| staff | `staff@vgb.local` | `staff-pass-1` |
| manager | `manager@vgb.local` | `manager-pass-8` |

Seed data: 3 products — `Widget` (SKU `W-001`, price 9.99, stock 10), `Gadget`
(`G-002`, 19.99, 5), `Doohickey` (`D-003`, 4.99, 0).

## 2. Interface contract (binding)

### 2.1 Pages and required test IDs

| Page | Path | Required `data-testid` |
|---|---|---|
| Login | `/login` | `login-email`, `login-password`, `login-submit`, `login-error` |
| Products (list) | `/products` | `product-list`, `product-item`, `product-search`, `product-empty`, `product-order-link` |
| Order form | `/products/{id}/order` | `order-qty`, `order-submit`, `order-form-error`, `order-success` |
| Inventory admin | `/inventory` | `inventory-list`, `inventory-item`, `inventory-stock-input`, `inventory-save` |
| Not found | any undefined path | `not-found` |

### 2.2 API endpoints

| Method + path | Auth | Success | Failure |
|---|---|---|---|
| `POST /api/auth/login` | none | 200 `{token, role}` | 401 |
| `POST /api/auth/logout` | session | 204 | 401 |
| `GET /api/products` | session | 200 `{products: [{id, name, sku, price, stock}]}` | 401 |
| `GET /api/orders` | session | 200 `{orders: [{id, productId, qty}]}` | 401 |
| `POST /api/products/{id}/order` | staff or manager | body `{qty}` (integer ≥ 1); 201 `{order}` with fields `id,productId,qty`; decrements stock | 400 qty < 1 or non-integer or qty > stock; 401 anonymous |
| `PATCH /api/products/{id}` | manager only | body `{stock}`; 200 `{product}` | 403 staff; 400 non-integer stock |
| `DELETE /api/products/{id}` | manager only | 204 | 403 staff; 404 unknown |

Order object shape: `{"id": "string|int", "productId": "string|int", "qty": "int"}`.

## 3. Functional requirements (FUNC-*)

1. F1. Staff login lands on `/products` and sees all three seeded products.
2. F2. Product search narrows by name or SKU.
3. F3. Staff orders qty 2 of a product with stock 10; order succeeds, stock shows 8,
   order recorded (restart covered by DB-001).
4. F4. Ordering qty greater than stock shows `order-form-error` and creates no order
   (and does not change stock).
5. F5. Ordering qty 0 or a non-integer shows a validation error, creates nothing.
6. F6. Empty search result shows `product-empty`.
7. F7. `/nope` renders `not-found`.
8. F8. `POST /api/products/{id}/order` with `{qty: 0}` returns 400.

## 4. Security requirements (AUTHZ-*, SEC-*)

1. S1. Anonymous requests to any page/API except login denied.
2. S2. Staff calling `PATCH /api/products/{id}` gets 403 (manager-only).
3. S3. Staff calling `DELETE /api/products/{id}` gets 403.
4. S4. Staff must not reach `/inventory` UI (redirect/denial).
5. S5. Logout invalidates session (AUTHZ-006).
6. S6. Passwords hashed (SEC-006); no secrets in source (SEC-002); no debug endpoints
   (SEC-004); npm audit no high/critical (SEC-003); cookie/token storage per APP-01
   §4.S4 rule (SEC-005).

## 5. Accessibility (A11Y-*)

Zero axe-core violations on `/login`, `/products`, `/products/{id}/order`; `lang` and
`<title>` set everywhere.

## 6. Persistence (DB-*)

Orders, stock updates, and deletions survive restart; API shapes match §2.2 exactly.

## 7. Build (BUILD-*, TYPE-*, LINT-*)

Same as APP-01 §7.
