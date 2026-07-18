# Authentication & permissions

## Session model

| Client | Mechanism |
|--------|-----------|
| Web PWA | HttpOnly cookie `leo.sid` (mirrored in ASP.NET; Secure only when request is HTTPS / `X-Forwarded-Proto`) |
| Sky Office (`leo-android`) | Bearer = session id from `GET /api/auth/mobile-token` (DataStore) |
| SMS gateway node (same app) | `gatewayId` + `gatewayKey` (hub query / REST body) — **not** a user session |

Both resolve to the same Postgres-backed session row (`session` table via `connect-pg-simple`).

### Cookie settings (`lib/session.ts`)

- Name: `leo.sid`
- `httpOnly: true`
- `sameSite: lax`
- `maxAge`: 7 days
- `secure: "auto"` when `COOKIE_SECURE=true` — secure cookies on HTTPS (LAN); allows HTTP Tailscale web if used
- `disableTouch: true` — avoids per-request session row updates / lock storms

`SESSION_SECRET` is required at boot.

## Auth endpoints

| Endpoint | Behavior |
|----------|----------|
| `POST /api/auth/register` | Create user (subject to product rules) |
| `POST /api/auth/login` | Authenticate; establish session |
| `GET /api/auth/me` | Current user, role, linked entity |
| `POST /api/auth/logout` | Destroy session |
| `GET /api/auth/mobile-token` | Return session id for Authorization header |

Web client recovery: on non-auth 401, `apiFetch` refreshes via AuthProvider once then retries.

## Roles

| Role | Intent |
|------|--------|
| `superuser` | Owner — settings, permissions, full control |
| `admin` | Office operations |
| `company` | Scoped to linked company |
| `client` | Scoped to linked client |
| `agent` | Field / scoped lists |
| `employee` | Own passport + salary |

Bootstrap: first start seeds superuser from `SUPERUSER_EMAIL` / `SUPERUSER_PASSWORD` in `api/.env`.

## Middleware stacking

From `app.ts`:

1. Public routers (health already separate; branding; public print/profile)
2. Most domains: `requireAuth` → `permissionsMiddleware`
3. Extra `requireRole("admin", "superuser")` — users admin, passwords
4. Extra `requireRole("superuser")` — permissions matrix

`requireAuth` also accepts `Authorization: Bearer <sid>` for mobile.

## Permissions matrix

Stored in `role_permissions`. Superuser edits via `/permissions` UI and `admin-permissions` API. Middleware enforces module-level allow/deny on top of role checks.

`linked_entity_id` on `users` scopes company / client / employee rows to their entity.

## CORS

`CORS_ORIGIN` is a comma-separated allowlist (credentials: true). Production must include both:

- `https://192.168.18.150`
- `http://100.126.222.96`

(and any explicit ports used in development).

## Public exceptions (conceptual)

Health, branding metadata/logos, selected print/public profile reads, and some LOA/billing public helpers do not require a session. Prefer treating print URLs as sensitive (unguessable ids) — do not expose the stack to the public internet without hardening.
