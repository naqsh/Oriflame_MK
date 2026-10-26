# Lessons Log — Oriflame Pakistan Referral Store

> **Note:** Update this file immediately after any user correction or mistake discovery.

---

## Lessons — October 2026

| Date | Mistake Pattern | Root Cause | Rule to Prevent Recurrence |
|---|---|---|---|
| 2026-10-26 | Port 8000 still served after stopping `uvicorn --reload` | On Windows the reload worker (a `multiprocessing.spawn` child) outlives its killed parent | After stopping a `--reload` server, check `Get-NetTCPConnection -LocalPort 8000`. Stop the leftover `python ... multiprocessing.spawn` process too, or run without `--reload` for scripted checks |
| 2026-10-26 | `/status` showed the build-time backend state forever | With `cacheComponents`, a `fetch` (even `cache: "no-store"`) that settles during `next build` is prerendered | Call `await connection()` (`next/server`) at the top of any Server Component that must run per request. Confirm `◐` (Partial Prerender), not `○`, in the build output. Mock it in Vitest |
| 2026-10-26 | Production frontend reported the backend unavailable while it was up | `NEXT_PUBLIC_*` values are inlined at **build** time; `next start` alone does not read them | Set `NEXT_PUBLIC_API_BASE_URL` before `npm run build` |
| 2026-10-26 | `npm install -D @vitejs/plugin-react` fails with ERESOLVE (Babel 8 optional peers) | Plugin's optional peer chain conflicts with Next 16's Babel | Not needed: Vitest compiles TSX using `jsx: react-jsx` from tsconfig. Do not add the plugin or use `--legacy-peer-deps` |
| 2026-10-26 | Vitest file using `import.meta.url` with `fileURLToPath` throws under jsdom | jsdom environment's `import.meta.url` is not a `file:` URL | Put `// @vitest-environment node` on tests that only touch the filesystem |
| 2026-10-26 | SQLAlchemy 2.1 warned `Result.tuples()` / `Row.tuple()` are deprecated | Rows behave like tuples since 2.1 | Unpack rows directly (`for a, b in result`, `x, y = row`). Run `pytest -W error::DeprecationWarning` before marking done |
| 2026-10-26 | Pydantic `HttpUrl` field typed as `AfterValidator(str)` still made mypy require `HttpUrl` at call sites | The annotation's base type, not the validator's return, drives the signature | Annotate as `str` and validate inside `AfterValidator` with a `TypeAdapter(HttpUrl)` |
| 2026-10-27 | LCP and FCP read from the in-app browser came out as 7 s and 22 s while TTFB was 20 ms | The browser pane was hidden, so the page did not paint until a screenshot forced it; streamed Suspense content was also held back | Do not record paint metrics from a hidden pane. Use TTFB, `responseEnd`, CLS and the LCP *element*, or run Lighthouse in a visible browser. Check server HTML with `curl` before suspecting a rendering bug |
| 2026-10-26 | `uv run mypy` fails with "An Application Control policy has blocked this file" | Windows Application Control blocks the `mypy.exe` launcher in `.venv/Scripts` | On this machine run `uv run python -m mypy backend` (the same applies to any blocked tool launcher) |

---

## Common Pitfalls to Avoid

### Referral
- Never hardcode the consultant code or referral URL — configuration only, via `ReferralService`
- Never build referral URLs in UI components
- Never assume appending a code to an arbitrary URL creates attribution
- Never claim a sale was attributed without Oriflame confirmation
- Never expose the consultant code via `NEXT_PUBLIC_` unless confirmed intentionally public

### Catalogue
- Never fabricate products, SKUs, prices, ratings, reviews, or stock
- Never bypass authentication, anti-bot systems, access restrictions, or rate limits
- Never assume images/content may be republished without confirmed permission
- Never describe stale data as real-time; label unverified availability honestly
- Mock data only in explicitly named development fixtures

### Architecture
- No tenant tables, vendor management, or billing in this phase
- Keep routers/services/repositories/integration/admin boundaries clean
- Every schema change ships with an Alembic migration

### Security
- Admin routes are never publicly accessible
- Never log secrets or sensitive values
- Do not collect payment card details or delivery addresses

### Testing
- Never mark a task complete without test evidence
- Never claim checks passed if they were not run
- Mock external Oriflame sources in CI — never hit real services

### Workflow
- Inspect the repository before changing it; never assume an empty project
- Never implement before the plan is confirmed
- Always update `todo.md` before starting implementation
- Ask before destructive changes, paid services, or checkout/payment integration

---

## Session Log

| Session Date | Key Lessons Learned |
|---|---|
| 2026-10-26 | Documentation structure established from Claude.md spec |

---

*Last Updated: October 2026*
