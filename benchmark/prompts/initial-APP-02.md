# Initial Generation Prompt — APP-02 Dashboard (FROZEN v1.0.0)

Delivered verbatim to each builder (platform-imposed deviations logged).

---

Build a complete multi-role SaaS dashboard web application for managing projects and
tasks. It must be a full-stack application: frontend UI, backend API, and a persistent
server-side database (not in-memory). Export/produce the full source code so it can be
installed and run locally.

Roles and seeded accounts (create on first start):
- viewer: viewer@vgb.local / viewer-pass-1
- member: member@vgb.local / member-pass-2
- admin: admin@vgb.local / admin-pass-9

Seed data: 2 projects — "Website Refresh" and "Mobile App" — each with 2 tasks titled
"Task A" and "Task B".

Pages and behavior:
- /login — login form. data-testid: login-email, login-password, login-submit,
  login-error. On success go to /projects.
- /projects — list projects. data-testid: project-list, project-item, project-search,
  project-empty. Search narrows by name.
- /projects/{id} — task list for the project. data-testid: task-list, task-item,
  task-new-link.
- /projects/{id}/tasks/new — form with title and status (todo/doing/done).
  data-testid: task-title, task-status, task-submit, task-form-error. Title required;
  empty title shows an error and creates nothing.
- /admin — admin-only user list. data-testid: admin-user-list, admin-user-item.
- Unknown paths show a not-found view, data-testid: not-found.

API contract (must match exactly):
- POST /api/auth/login {email, password} → 200 {token, role} | 401
- POST /api/auth/logout → 204 (session invalid afterwards)
- GET /api/projects → 200 {projects: [{id, name}]} | 401
- POST /api/projects/{id}/tasks {title, status} → 201 {task} where task =
  {id, title, status, projectId} | 403 for viewer | 400 missing title | 401
- PATCH /api/tasks/{id} → 200 {task} (e.g., change status) | 403 viewer | 404 |
  400 on invalid status value
- DELETE /api/tasks/{id} → admin only, 204 | 403 for member/viewer
- GET /api/admin/users → 200 {users: [{email, role}]} | 403 non-admin | 401

Security requirements:
- Everything except /login and /api/auth/login requires a session.
- Viewer must get 403 on task create/edit API calls.
- Member must get 403 on GET /api/admin/users and DELETE /api/tasks/{id}, and must
  not reach /admin in the UI.
- Cookies must be HttpOnly and SameSite if used; tokens must not be stored in
  localStorage (sessionStorage or cookie instead).
- Hash passwords; no plaintext storage.
- No hard-coded secrets; no debug/test endpoints.

Quality requirements:
- Accessibility: zero axe-core violations (WCAG 2.1 A/AA) on /login, /projects, and
  /projects/{id}/tasks/new. Set html lang and a non-empty title on every page.
- Persistence: created/edited/deleted tasks survive an application restart.
- TypeScript must compile with tsc --noEmit if used. ESLint clean. Build must succeed;
  start command serves on PORT.
