# 项目组队与成员招募 Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Docker-deployable full-stack demo for the student project recruitment workflow, including real persistence, permissions, application state transitions, and concurrency-safe role capacity.

**Architecture:** A Vite React frontend is built into static assets and served by a Fastify API server. PostgreSQL stores users, profiles, projects, roles, applications, snapshots, and members; the API performs authorization and transactional approval. Docker Compose runs the app and database with a named persistent volume.

**Tech Stack:** React, Vite, TypeScript, Fastify, PostgreSQL, `pg`, Vitest, Node test runner, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-05-team-recruitment-demo-design.md`

## Global Constraints

- Every business operation must use the backend as the source of truth; UI state cannot substitute for authorization or capacity checks.
- A project owner is displayed as a member but never consumes a recruitable role capacity.
- A pending application does not consume capacity; an approved application consumes exactly one seat in its role.
- A rejected or withdrawn application remains in history and may be followed by a new application only after all active-application/member constraints pass.
- Application profile data is snapshotted at submission time.
- The acceptance transaction must not leave an approved application without a member or a member without its capacity.
- Every code change includes relevant tests and is committed separately.

---

### Task 1: Repository and runtime foundation

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `server/app.ts`, `server/config.ts`, `server/types.ts`
- Create: `frontend/src/main.tsx`, `frontend/src/styles.css`
- Create: `tests/smoke.test.ts`
- Create: `.gitignore`, `.env.example`

**Interfaces:**
- Produces an npm workspace with `dev`, `build`, `test`, `start` scripts and a Fastify server entry point.
- Provides a testable `createApp()` function and a Vite build that can be served by the API.

- [ ] Write a smoke test that imports the server factory and asserts the health response contract.
- [ ] Run the smoke test and verify it fails because the server factory does not exist.
- [ ] Add the TypeScript/Vite/Fastify runtime foundation and a `/api/health` route.
- [ ] Run the smoke test and production build to verify the foundation passes.
- [ ] Commit `chore: scaffold team recruitment demo`.

### Task 2: Database schema and seed data

**Files:**
- Create: `db/init/001_schema.sql`
- Create: `db/init/002_seed.sql`
- Create: `server/db.ts`
- Create: `tests/schema-contract.test.ts`

**Interfaces:**
- `server/db.ts` exports a PostgreSQL pool factory and query helper.
- SQL defines `users`, `projects`, `project_roles`, `applications`, `project_members` and the required constraints.

- [ ] Write contract tests for seed account count, project state coverage, and the one-seat/two-pending-applications fixture.
- [ ] Run the contract tests and verify they fail because schema and seed files are absent.
- [ ] Add schema, indexes, seed accounts, hashed passwords, three projects, roles, members, and applications.
- [ ] Run the SQL contract tests and verify all fixtures and constraints are present.
- [ ] Commit `feat: add persistent database schema and demo fixtures`.

### Task 3: Domain rules and authentication/profile APIs

**Files:**
- Create: `server/domain/rules.ts`
- Create: `server/routes/auth.ts`, `server/routes/profile.ts`
- Create: `tests/rules.test.ts`, `tests/auth-profile.test.ts`

**Interfaces:**
- `filterProjects(projects, filters)` enforces AND matching and same-role skill matching.
- Auth routes establish and clear an HttpOnly cookie session.
- Profile routes read and update the authenticated user profile.

- [ ] Write failing tests for same-role filtering, multi-skill matching, login, session lookup, and profile update.
- [ ] Run the tests and verify expected failures before implementation.
- [ ] Implement rules, session handling, auth routes, profile validation, and API error shape.
- [ ] Run the targeted tests and verify they pass.
- [ ] Commit `feat: add auth profile and project filtering rules`.

### Task 4: Project and application APIs

**Files:**
- Create: `server/routes/projects.ts`, `server/routes/applications.ts`
- Modify: `server/app.ts`
- Create: `tests/application-api.test.ts`

**Interfaces:**
- Project list/detail routes return calculated role capacity and public member data.
- Project creation validates at least one role and stores owner membership separately from role capacity.
- Application creation stores a profile snapshot and enforces project owner, pause, capacity, membership, and pending-application rules.
- Withdrawal is allowed only for the applicant while the application is pending.

- [ ] Write failing API tests for project creation, project list filters, application creation, duplicate prevention, owner prevention, pause prevention, withdrawal, and snapshot visibility.
- [ ] Run the tests and verify failures identify missing routes.
- [ ] Implement project and application routes with database-backed authorization.
- [ ] Run the targeted API tests and verify they pass.
- [ ] Commit `feat: add project browsing and application workflow`.

### Task 5: Transactional review and concurrency protection

**Files:**
- Modify: `server/routes/applications.ts`
- Create: `tests/review-concurrency.test.ts`
- Modify: `db/init/001_schema.sql` if needed for constraints

**Interfaces:**
- `POST /api/applications/:id/approve` atomically changes a pending application to approved and inserts one member.
- `POST /api/applications/:id/reject` requires an owner and non-empty reason.
- All stale, duplicate, full-capacity, and unauthorized requests return explicit error codes.

- [ ] Write failing tests for owner-only review, rejection reasons, duplicate review, two concurrent approvals for one seat, and withdrawal/approval races.
- [ ] Run the tests and verify the race tests fail against the unimplemented review endpoint.
- [ ] Implement transaction locking, unique-member protection, capacity checks, and idempotent response handling.
- [ ] Run the concurrency tests repeatedly and verify at most one member occupies the seat.
- [ ] Commit `feat: make application review capacity-safe`.

### Task 6: Frontend workflow

**Files:**
- Create: `frontend/src/api.ts`, `frontend/src/App.tsx`, `frontend/src/components/*`
- Modify: `frontend/src/styles.css`, `frontend/src/main.tsx`
- Create: `tests/frontend-contract.test.ts`

**Interfaces:**
- The UI supports login, project filters, project detail, application submission/withdrawal, review, recruitment pause/resume, profile editing, and result views.
- Each request renders loading, success, error, empty, and capacity-conflict feedback.

- [ ] Write frontend contract tests for API payload mapping and key status labels.
- [ ] Run the tests and verify they fail before the UI exists.
- [ ] Implement the single-page responsive UI with accessible form labels and explicit server feedback.
- [ ] Run frontend tests and production build.
- [ ] Commit `feat: add recruitment workflow frontend`.

### Task 7: Docker, documentation, and acceptance verification

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `.dockerignore`
- Create: `README.md`, `tests/acceptance-checklist.md`
- Modify: `server/app.ts` for static serving and production startup

**Interfaces:**
- `docker compose up --build` starts the app and PostgreSQL.
- `http://localhost:3000` serves the frontend and `/api/health` confirms readiness.
- The named volume preserves database data across container recreation.

- [ ] Write the acceptance checklist with exact commands for the three core scenarios, permission checks, and persistence check.
- [ ] Run the checklist against the local app or document the Docker limitation if Docker is unavailable.
- [ ] Add Docker health checks, environment configuration, database dependency, persistent volume, and README initialization instructions.
- [ ] Run npm tests, production build, and Docker build/start verification when the Docker CLI is available.
- [ ] Commit `docs: add docker demo setup and acceptance evidence`.
