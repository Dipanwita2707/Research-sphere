# Codebase Index

This repository is a monorepo for the SGT University Management System. It combines a Next.js frontend, an Express/Prisma backend, deployment assets, infrastructure code, and a large set of operational scripts.

## Top-Level Map

| Path | Purpose |
| --- | --- |
| `frontend/` | Next.js 14 app router frontend in TypeScript |
| `backend/` | Express API, Socket.IO server, Prisma schema, migrations, scripts |
| `terraform/` | AWS infrastructure definitions |
| `scripts/` | Repo-level setup and deployment scripts |
| `ref/` | Reference notes and implementation docs |
| Root `*.md` files | Feature notes, setup guides, deployment docs, migration docs |

## Runtime Entry Points

### Frontend

- App root: `frontend/src/app/layout.tsx`
- Default route: `frontend/src/app/page.tsx` redirects to `/dashboard`
- Styling root: `frontend/src/styles/globals.css`
- Main providers:
  - `AuthProvider`
  - `ThemeProvider`
  - `ErrorBoundary`
  - `ToastProvider`
  - `ConfirmModalProvider`

### Backend

- Server entry: `backend/src/server.js`
- API prefix: `/api/v1`
- Real-time transport: Socket.IO initialized in `backend/src/server.js`
- Static file serving: `/uploads` from `backend/uploads`
- Shared middleware:
  - Helmet
  - CORS
  - Rate limiting
  - Audit middleware
  - Global error handler

## Backend Index

### Route Mounting

The backend has one central router in `backend/src/modules/core/routes/index.js`. It mounts both administrative routes and domain modules.

#### Core/admin route groups

- `/auth`
- `/dashboard`
- `/permissions`
- `/permission-management`
- `/roles`
- `/designations`
- `/users`
- `/schools`
- `/central-departments`
- `/departments`
- `/programs`
- `/employees`
- `/students`
- `/bulk-upload`
- `/analytics`
- `/notifications`
- `/file-upload`

#### Domain route groups

- `/research`
- `/grants`
- `/ipr`
- `/finance`
- `/noting`
- `/dsw`
- `/events`
- `/chat`
- `/mail`
- `/audit`

#### Backward-compatibility routes

These legacy-style endpoints are still mounted for frontend compatibility:

- `/research-policies`
- `/book-policies`
- `/book-chapter-policies`
- `/conference-policies`
- `/grant-policies`
- `/incentive-policies`
- `/research-progress`
- `/drd-review`
- `/dean-approval`
- `/collaborative-editing`
- `/google-docs`
- `/ipr-management`

### Backend Module Directory

| Module | Responsibility |
| --- | --- |
| `auth/` | Login, auth flows, profile-photo auth middleware |
| `analytics/` | University analytics endpoints |
| `audit/` | Audit logs, audit reports, scheduler |
| `chat/` | Direct messages, groups, permissions, uploads, sockets |
| `core/` | Dashboard, master data, admin CRUD, permissions, bulk upload |
| `dsw/` | DSW clubs, categories, approvals, statistics |
| `event-management/` | Event creation, registration, volunteering, scanning |
| `finance/` | Finance review workflows |
| `grants/` | Grant application flows |
| `ipr/` | IPR applications, reviews, management workflows |
| `mail/` | Internal mail threads, drafts, labels, search, attachments |
| `notifications/` | User notifications |
| `noting/` | Noting workflow and note movement |
| `research/` | Research contributions, progress tracking, reviews, policies |

### Shared Backend Infrastructure

| Path | Responsibility |
| --- | --- |
| `backend/src/shared/config/` | App config, Prisma client, permissions, Redis |
| `backend/src/shared/database/` | Seed scripts, migration helpers, legacy DB utilities |
| `backend/src/shared/middleware/` | Auth, audit, error handling |
| `backend/src/shared/utils/` | Validators, audit logging, async helpers, response helpers |
| `backend/prisma/schema.prisma` | Canonical database schema |
| `backend/prisma/migrations/` | Prisma-managed DB changes |
| `backend/prisma/manual-migrations/` | Manual SQL migrations and helpers |

### Database Shape

`backend/prisma/schema.prisma` is large and acts as a shared schema for multiple university workflows, not just one product slice.

Notable model clusters visible from the schema:

- Identity and org structure: `UserLogin`, `EmployeeDetails`, `StudentDetails`, departments, schools, programs
- Research: contributions, trackers, policies, reviews
- IPR: applications, contributors, reviews, status history
- DSW: clubs, categories, memberships, club audits
- Chat: groups, memberships, messages, permissions, presence
- Mail: threads, recipients, drafts, labels, attachments
- Events: events, registrations, volunteers
- Audit and permissions: audit logs, department permissions, role templates

### Backend Scripts and Ops

| Path | Use |
| --- | --- |
| `backend/scripts/tests/` | Script-based API and DB checks |
| `backend/scripts/maintenance/checks/` | Health and integrity checks |
| `backend/scripts/maintenance/fixes/` | Targeted data repair scripts |
| `backend/scripts/maintenance/recalculations/` | Recompute research/incentive values |
| `backend/scripts/database/seeds/` | Seed helpers |
| `backend/check_users.js`, `backend/test-dipa-access.js`, similar files | One-off operational scripts |

## Frontend Index

### App Router Areas

The frontend uses the Next.js app router under `frontend/src/app`.

Top-level route groups currently include:

- `admin/`
- `api/`
- `auth-debug/`
- `chat/`
- `dashboard/`
- `dean/`
- `departments/`
- `drd/`
- `dsw/`
- `events/`
- `finance/`
- `hr/`
- `ipr/`
- `it/`
- `library/`
- `login/`
- `mail/`
- `mentor-approvals/`
- `my-work/`
- `notifications/`
- `noting/`
- `permissions/`
- `profile/`
- `research/`
- `settings/`

### Frontend Feature Directory

| Feature | Responsibility |
| --- | --- |
| `admin-management/` | Admin panels, policies, schools, roles, permissions, analytics |
| `chat/` | Chat UI, stores, socket hooks, composer, message list |
| `dashboard/` | Role-based dashboards, widgets, hero, quick access |
| `dsw/` | Club creation and DSW-specific UI |
| `event-management/` | Event-facing services and UI |
| `ipr-management/` | IPR forms, review dashboards, collaborative editor |
| `mail/` | Mail layout, thread list, compose flow, store |
| `noting-management/` | Noting-related UI |
| `progress-tracking/` | Research progress tracker forms and status updates |
| `research-management/` | Research contribution and grant workflows |

### Shared Frontend Infrastructure

| Path | Responsibility |
| --- | --- |
| `frontend/src/shared/components/` | Shared layout and UI components |
| `frontend/src/shared/hooks/` | Reusable hooks like API, debounce, pagination, permissions |
| `frontend/src/shared/layouts/` | Shared page shells |
| `frontend/src/shared/providers/` | App-wide React providers |
| `frontend/src/shared/services/` | Shared API service wrappers |
| `frontend/src/shared/types/` | Common TypeScript models |
| `frontend/src/shared/utils/` | Formatters, validators, helpers, error handling |
| `frontend/src/shared/ui-components/` | Toasts, modals, loading, cards |

## Infra and Deployment

| Path | Responsibility |
| --- | --- |
| `docker-compose.yml` | Main multi-service local/dev orchestration |
| `docker-compose.dev.yml` | Alternate dev composition |
| `Dockerfile.backend` | Backend container build |
| `Dockerfile.frontend` | Frontend container build |
| `nginx.conf` | Reverse proxy config |
| `render.yaml` | Render deployment config |
| `terraform/*.tf` | AWS VPC, ECS, DB, security group, LB definitions |
| `scripts/setup-dev.*` | Local environment setup |
| `scripts/build-and-deploy.sh` | Build/deploy helper |
| `scripts/deploy-aws.sh` | AWS deployment helper |

## Where To Start For Common Changes

| Goal | Start Here |
| --- | --- |
| Add a new API endpoint | `backend/src/modules/<domain>/routes/` then matching controller/service |
| Change auth or request guards | `backend/src/shared/middleware/auth.js` and `backend/src/modules/auth/` |
| Change admin CRUD or master data | `backend/src/modules/core/controllers/` and `backend/src/modules/core/routes/` |
| Update DB tables or relations | `backend/prisma/schema.prisma` and related migrations |
| Change chat behavior | `backend/src/modules/chat/` and `frontend/src/features/chat/` |
| Change internal mail | `backend/src/modules/mail/` and `frontend/src/features/mail/` |
| Change DSW clubs | `backend/src/modules/dsw/` and `frontend/src/app/dsw/` plus `frontend/src/features/dsw/` |
| Change event management | `backend/src/modules/event-management/` and `frontend/src/app/events/` |
| Change research or progress tracking | `backend/src/modules/research/`, `frontend/src/app/research/`, `frontend/src/features/research-management/`, `frontend/src/features/progress-tracking/` |
| Change IPR flows | `backend/src/modules/ipr/`, `frontend/src/app/ipr/`, `frontend/src/features/ipr-management/` |
| Change dashboards | `frontend/src/app/dashboard/` and `frontend/src/features/dashboard/` |

## Notes

- The repository contains many implementation and migration notes at the root and inside `backend/` and `frontend/`. They are useful context, but some are historical and should be validated against the current route mounts and schema.
- The worktree currently contains unrelated in-progress changes in chat and mail files. This index was added without modifying those files.
