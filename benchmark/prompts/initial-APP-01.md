# Initial Generation Prompt — APP-01 Booking (FROZEN v1.0.0)

Delivered verbatim to each builder. The bracketed platform note is only used when a
platform imposes a hard constraint; the note used and the reason are logged.

---

Build a complete appointment booking web application for a small clinic. It must be a
full-stack application: frontend UI, backend API, and a persistent server-side database
(SQLite, Postgres, or equivalent embedded/server persistence — not in-memory storage).
Export/produce the full source code so it can be installed and run locally.

Roles and seeded accounts (create these on first start):
- patient: patient@vgb.local / patient-pass-1
- admin: admin@vgb.local / admin-pass-9

Pages and behavior:
- /login — email + password login. On success go to /appointments. Wrong credentials
  show an error message. Elements must have data-testid attributes: login-email,
  login-password, login-submit, login-error.
- /appointments — list of the logged-in patient's appointments (admin sees all).
  Each item shows date, time, reason. data-testid: appt-list, appt-item, appt-new-link,
  appt-search, appt-empty (shown when no items match). Search narrows by reason.
- /appointments/new — form with date, time, reason. data-testid: appt-date, appt-time,
  appt-reason, appt-submit, appt-form-error. All fields required; show a validation
  error and do not create the record if any is empty.
- /admin — admin-only overview with the total number of appointments
  (data-testid: admin-appointment-count) and a list (data-testid: admin-list).
- Unknown paths must show a not-found view with data-testid: not-found.

API contract (must match exactly):
- POST /api/auth/login {email, password} → 200 {token, role} | 401 {error}
- POST /api/auth/logout → 204 (session must be invalid afterwards)
- GET /api/appointments → 200 {appointments: [...]} (patient: own only; admin: all) | 401
- POST /api/appointments {date, time, reason} → 201 {appointment} where appointment =
  {id, date: YYYY-MM-DD, time: HH:MM, reason, patient} | 400 on missing fields | 401
- DELETE /api/appointments/{id} → 204 | 403 if not owner and not admin | 404
- GET /api/admin/stats → 200 {total} | 403 for patient | 401 anonymous

Security requirements:
- All pages and APIs except /login and /api/auth/login require a valid session.
- A patient must get 403 on GET /api/admin/stats and must not reach /admin.
- A patient must get 403 deleting another patient's appointment.
- If you use cookies for sessions they must be HttpOnly and SameSite; if you use a
  token, do not store it in localStorage (use sessionStorage or a cookie).
- Hash passwords (bcrypt/argon2 or equivalent) — never store plaintext.
- No hard-coded secrets in source; read them from environment variables.
- No debug/test endpoints in the production build.

Quality requirements:
- Accessibility: zero axe-core violations (WCAG 2.1 A/AA) on /login, /appointments,
  and /appointments/new. Set the html lang attribute and a non-empty title on every page.
- Persistence: every created, updated, or deleted record must survive an application
  restart.
- If TypeScript is used it must compile with tsc --noEmit. Code must be lint-clean
  with no ESLint errors or warnings. The build command must succeed and the start
  command must serve the app on the PORT environment variable.
