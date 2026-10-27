# ADR-004: Deployment Target

**Status:** Proposed (owner decision needed: hosting may involve paid services)
**Date:** 2026-10-27
**Authors:** Claude Code Agent (OR-052)

## Context

The store has three parts: a Next.js frontend, a FastAPI API, and PostgreSQL (a separate production Supabase project; `docs/DATABASE.md`). Requirements that constrain hosting:

- **Next.js 16 with Cache Components and Partial Prerendering.** Every route renders at request time, so it needs a Node.js server (`next start`) or a host with native Next.js support. A static export is not possible.
- **API:** a long-running Python 3.12+ process (uvicorn), with health (`/health`) and readiness (`/health/ready`) endpoints for the platform's checks.
- **Rate limits and the sync lock:** rate limits are in-memory per process, so the API should run as **one instance** until a shared store is approved. The sync lock is a PostgreSQL advisory lock and works across instances.
- **Region:** Pakistan visitors, so a region near South Asia (e.g. Mumbai or Singapore) for the API and database.
- **Cost:** no paid service may be chosen without the owner.

## Decision (proposed)

The decision is the owner's. The application is host-agnostic and needs only environment variables, two processes and the migration command. Recommended shape:

| Part | Recommended | Alternatives |
|---|---|---|
| Frontend | A managed Next.js host (e.g. Vercel) in a region near Pakistan | Any container host running `npm run build && npm run start` behind HTTPS |
| API | One small container (e.g. Render, Railway, Fly.io) with `uv run uvicorn backend.app.main:create_app --factory --host 0.0.0.0 --port $PORT`, health check `/health/ready` | A VPS with a process manager and a reverse proxy (then set `TRUSTED_PROXIES`) |
| Database | Separate production Supabase project, session pooler or direct on port 5432, same region as the API | — |
| Migrations | `uv run alembic upgrade head` as a release/pre-deploy step, **before** traffic switches | — |

Accept this ADR once the owner has chosen the providers and the plans or costs.

## Consequences

### Positive
- No provider lock-in in the code: configuration is environment variables only (`.env.production.example`).
- Startup validation fails a misconfigured deploy before it serves traffic: missing `POSTGRES_URL`, non-https or wildcard `CORS_ORIGINS`, an invalid referral URL or host.

### Negative
- Until a host is chosen, a fresh deployment and a rollback have not been exercised (OR-052 testing criteria are open).
- A single API instance is required while rate limits are in memory.

## Alternatives Considered

### Everything on one VPS
- Cheapest at small scale, but the owner then patches the OS, TLS and the process manager. Reasonable if the owner prefers it.

### Serverless functions for the API
- Cold starts and per-invocation limits suit the in-memory rate limiter and the background sync poorly. Not recommended.
