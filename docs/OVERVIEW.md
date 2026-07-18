# Overview

## What it is

**Sky Office** (internally **LEO OS**) is the self-hosted operations platform for **Leo Employment Services**, a Maldives recruitment / manpower agency.

It covers the full worker lifecycle:

1. **Onboarding** — AI passport OCR → employee record → Letter of Appointment (LOA)
2. **Operations** — master employee list, company/client allocation, Xpat work-permit monitoring
3. **Finance** — monthly salary roster, client invoices/quotations, expense vouchers
4. **Access** — role-based web PWA for office staff + Sky Office Android for field use / SMS nodes

## Product surfaces

| Surface | Package | Tech | Who uses it |
|---------|---------|------|-------------|
| Web admin (PWA) | `@leo/web` | React 19, Vite, shadcn/ui, TanStack Query, wouter | Admins, office staff |
| Sky Office (Android) | `leo-android` · `com.sky.office` | Kotlin · Jetpack Compose · Hilt · `:feature-sms-gateway` | Field staff + SIM SMS phones |
| REST API | `leo-os-dotnet` | ASP.NET Core 8, EF Core, SignalR, sessions | All clients |
| Database | PostgreSQL 17 | Docker `postgres` | API only |

## Business domain (short)

| Concept | Meaning |
|---------|---------|
| **Passport / employee** | Candidate or worker record (OCR or manual) |
| **Company** | Recruiting company under Leo |
| **Client** | Employer (resort, etc.) the worker is allocated to |
| **LOA** | Letter of Appointment — one per passport |
| **Xpat** | External Maldives work-permit system (live lookups) |
| **Salary record** | Monthly payroll line (daily rates × days) |
| **Billing document** | Invoice or quotation sold to a client |
| **Passwords** | Per-company Efaas + Gmail credential vault |

## Tech stack summary

| Layer | Choice |
|-------|--------|
| API language | C# / ASP.NET Core 8 |
| Frontend | TypeScript 5 · pnpm (`leo-os/`) |
| ORM | EF Core (API) · Drizzle schema still reference for tables |
| OCR | Vision model via OpenAI-compatible API (`OPENAI_*` or `DEEPSEEK_*`) |
| Auth | Cookie sessions (web) + Bearer session token (mobile) |
| Deploy | Docker Compose + nginx reverse proxy on homelab |

## Where code lives

```
/home/adhuhaam/apps/          ← homelab deployment root (this repo)
├── docker-compose.yml        ← production stack
├── leo-os/                   ← React PWA monorepo
├── leo-os-dotnet/            ← primary ASP.NET Core API (+ SMS/Notification)
├── leo-android/              ← Sky Office (Compose · office + SMS node)
├── react/app/                ← built web static files
├── api/.env                  ← API secrets (server only)
├── infra/                    ← nginx + TLS certs
├── scripts/                  ← go-live / run-dotnet-api
└── docs/                     ← this documentation
```

See [REPOSITORY.md](REPOSITORY.md) for the full map and [ARCHITECTURE.md](ARCHITECTURE.md) for how requests flow.
