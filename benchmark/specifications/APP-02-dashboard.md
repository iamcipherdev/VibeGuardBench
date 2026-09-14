# APP-02 — Multi-Role SaaS Dashboard (Frozen Specification v1.0.0)

Frozen 2026-09-14. Part of VibeGuardBench. Changes after data collection begin require
a protocol amendment.

## 1. Overview

A small multi-tenant-style SaaS dashboard for managing projects and tasks, with three
roles and role-scoped navigation.

Roles:

- `viewer` — read-only access to projects and tasks.
- `member` — creates and edits tasks.
- `admin` — additionally manages users and sees the admin panel.

Seed accounts:

| Role | Email | Password |
|---|---|---|
| viewer | `viewer@vgb.local` | `viewer-pass-1` |
| member | `member@vgb.local` | `member-pass-2` |
| admin | `admin@vgb.local` | `admin-pass-9` |

Seed data (created on first start): 2 projects named `Website Refresh` and
`Mobile App`, each with 2 tasks titled `Task A`, `Task B`.

## 2. Interface contract (binding)

### 2.1 Pages and required test IDs

| Page | Path | Required `data-testid` |
|---|---|---|
| Login | `/login` | `login-email`, `login-password`, `login-submit`, `login-error` |
| Projects (list) | `/projects` | `project-list`, `project-item`, `project-search`, `project-empty` |
| Project detail | `/projects/{id}` | `task-list`, `task-item`, `task-status-select` (one per item, member/admin only), `task-new-link` |
| Task form | `/projects/{id}/tasks/new` | `task-title`, `task-status`, `task-submit`, `task-form-error` |
| Admin panel | `/admin` | `admin-user-list`, `admin-user-item` |
| Not found | any undefined path | `not-found` |

### 2.2 API endpoints

| Method + path | Auth | Success | Failure |
|---|---|---|---|
| `POST /api/auth/login` | none | 200 `{token, role}` | 401 |
| `POST /api/auth/logout` | session | 204 | 401 |
| `GET /api/projects` | session | 200 `{projects: [{id, name}]}` | 401 |
| `GET /api/projects/{id}/tasks` | session | 200 `{tasks: [{id, title, status, projectId}]}` | 401 |
| `POST /api/projects/{id}/tasks` | member or admin | 201 `{task}` with fields `id,title,status,projectId` | 403 viewer; 400 missing title; 401 anonymous |
| `PATCH /api/tasks/{id}` | member or admin | 200 `{task}` (e.g., change `status`) | 403 viewer; 404 unknown |
| `GET /api/admin/users` | admin only | 200 `{users: [{email, role}]}` | 403 non-admin; 401 anonymous |
| `DELETE /api/tasks/{id}` | admin only | 204 | 403 member/viewer |

Task object shape: `{"id": "string|int", "title": "string", "status": "todo|doing|done", "projectId": "string|int"}`.

## 3. Functional requirements (FUNC-*)

1. F1. Member login lands on `/projects` and sees both seeded projects.
2. F2. Project search narrows by name.
3. F3. Member creates a task in a project; it appears in the task list with its status.
4. F4. Member changes a task status via the task item's `task-status-select`; the
   change persists in the UI (restart covered by DB-002).
5. F5. Task form with empty title shows `task-form-error` and creates nothing.
6. F6. Empty project shows `project-empty` after search with no matches.
7. F7. `/nope` renders `not-found`.
8. F8. `PATCH /api/tasks/{id}` with an invalid status value returns 400.

## 4. Security requirements (AUTHZ-*, SEC-*)

1. S1. Anonymous requests to any page/API except login denied (401/redirect).
2. S2. Viewer calling `POST /api/projects/{id}/tasks` gets 403 (direct API write).
3. S3. Member calling `GET /api/admin/users` gets 403; member must not reach `/admin`
   UI.
4. S4. Member calling `DELETE /api/tasks/{id}` gets 403 (admin-only).
5. S5. Viewer has no create/edit controls rendered, and API still enforces 403.
6. S6. Session/token invalidated after logout (AUTHZ-006).
7. S7. Passwords hashed (SEC-006); no secrets in source (SEC-002); no debug endpoints
   (SEC-004); npm audit no high/critical (SEC-005 → SEC-003 mapping); cookie flags per
   SEC-005 rules in APP-01 §4.S4.

## 5. Accessibility requirements (A11Y-*)

Zero axe-core violations on `/login`, `/projects`, `/projects/{id}/tasks/new`; `lang`
and `<title>` set everywhere.

## 6. Persistence (DB-*)

Created/edited/deleted tasks survive restart; API shapes match §2.2 exactly.

## 7. Build (BUILD-*, TYPE-*, LINT-*)

Same as APP-01 §7.
