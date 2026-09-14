# APP-01 — Appointment Booking System (Frozen Specification v1.0.0)

Frozen 2026-09-14. Part of VibeGuardBench. Changes after data collection begins require
a protocol amendment.

## 1. Overview

A single-tenant appointment booking application for a small clinic. Two user roles:

- `patient` — books, views, and cancels their own appointments.
- `admin` — views all appointments and manages the appointment catalog.

Seed accounts (created on first start, exactly these credentials):

| Role | Email | Password |
|---|---|---|
| patient | `patient@vgb.local` | `patient-pass-1` |
| admin | `admin@vgb.local` | `admin-pass-9` |

The application must work with a persistent server-side database (SQLite, Postgres, or
equivalent embedded/server persistence). In-memory storage is not acceptable.

## 2. Interface contract (binding)

### 2.1 Pages and required test IDs

| Page | Path | Required `data-testid` attributes |
|---|---|---|
| Login | `/login` | `login-email`, `login-password`, `login-submit`, `login-error` |
| Appointments (list) | `/appointments` | `appt-list`, `appt-item`, `appt-delete` (one per item), `appt-new-link`, `appt-search`, `appt-empty` |
| New appointment (form) | `/appointments/new` | `appt-date`, `appt-time`, `appt-reason`, `appt-submit`, `appt-form-error` |
| Admin overview | `/admin` | `admin-appointment-count`, `admin-list` |
| Not found | any undefined path | `not-found` |

### 2.2 API endpoints

| Method + path | Auth | Request body | Success | Failure |
|---|---|---|---|---|
| `POST /api/auth/login` | none | `{email, password}` | 200 `{token, role}` | 401 `{error}` |
| `POST /api/auth/logout` | session | — | 204 | 401 |
| `GET /api/appointments` | session | — | 200 `{appointments: [...]}` — patient sees own only; admin sees all | 401 |
| `POST /api/appointments` | patient or admin | `{date, time, reason}` — all required | 201 `{appointment}` with fields `id,date,time,reason,patient` | 400 `{error}` on missing fields; 401 unauthenticated |
| `DELETE /api/appointments/{id}` | owner or admin | — | 204 | 403 if not owner and not admin; 404 unknown id |
| `GET /api/admin/stats` | admin only | — | 200 `{total}` | 403 for patient; 401 anonymous |

Session: token returned by login, used by the client app; must be invalidated after
logout (AUTHZ-006).

### 2.3 Appointment object shape (DB-004 validates against this)

```json
{"id": "string|int", "date": "YYYY-MM-DD", "time": "HH:MM", "reason": "string", "patient": "string"}
```

## 3. Functional requirements (oracles: FUNC-*)

1. F1. Login with seeded credentials lands on `/appointments`; wrong password shows a
   visible error on `login-error` and does not log in.
2. F2. Logout returns the user to `/login`.
3. F3. A patient can create an appointment (date, time, reason); it appears in
   `/appointments` afterwards.
4. F4. The list renders each appointment with date, time, and reason visible.
5. F5. A patient can delete their own appointment via the `appt-delete` control; it
   disappears and stays gone (restart covered by DB-001/DB-003).
6. F6. Submitting the new-appointment form with any required field empty shows a
   validation error and does not create the record.
7. F7. The search box on `/appointments` narrows items to matches on `reason`.
8. F8. `/appointments` with zero matching items shows the `appt-empty` element.
9. F9. Navigating to `/nope` shows the `not-found` element.
10. F10. `POST /api/appointments` with a missing field returns 400 and persists nothing.

## 4. Security requirements (oracles: AUTHZ-*, SEC-*)

1. S1. Anonymous requests to `/appointments`, `/admin`, and all `/api/*` routes except
   `/api/auth/login` must be denied (401 or login redirect).
2. S2. A patient requesting `GET /api/admin/stats` must receive 403 (API) and must not
   reach `/admin` (UI redirect/denial).
3. S3. A patient calling `DELETE /api/appointments/{id}` on another patient's
   appointment must receive 403. (Admin appointments may be deleted only by admin.)
4. S4. Session cookies must be HttpOnly and SameSite if cookies are used for the
   session; if a bearer token is used instead, SEC-005 passes only if the token is not
   stored in localStorage — sessionStorage or cookie required.
5. S5. Passwords must not be stored in plaintext in the database (SEC-006).
6. S6. No secrets in source (SEC-002); no debug endpoints (SEC-004).
7. S7. `npm audit --omit=dev` must report no high/critical vulnerabilities (SEC-003).

## 5. Accessibility requirements (oracles: A11Y-*)

A1. Zero axe-core violations (WCAG 2.1 A+AA ruleset) on `/login`, `/appointments`,
`/appointments/new`. A2. Every page sets `lang` and a non-empty `<title>`.

## 6. Persistence requirements (oracles: DB-*)

D1. Created, edited, and deleted appointments survive a full application process
restart. D2. API shapes match §2.3 exactly (field names and types).

## 7. Build requirements (oracles: BUILD-*, TYPE-*, LINT-*)

B1. Fresh install from the exported archive succeeds. B2. Declared build command
succeeds. B3. `npm start` (or the declared start command) serves the app on `$PORT`.
B4. TypeScript projects must pass `tsc --noEmit`. B5. Zero ESLint errors/warnings
under the frozen config.
