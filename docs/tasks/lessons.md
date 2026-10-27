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
| 2026-10-27 | Interactions in the hidden in-app browser did nothing (a select change did not update the URL) | The page had not hydrated: a hidden pane does not run frames until something forces a render | Check hydration (`__reactFiber` keys on an element) before testing interactions; a screenshot attempt forces a frame. Do not report a client bug until hydration is confirmed |
| 2026-10-27 | Vitest could not render a Server Component that returns another async component | React Testing Library renders on the client, where async components are unsupported | Use `__tests__/render-server.tsx` (`renderServer`) to resolve nested async Server Components first |
| 2026-10-27 | A commit went out after `pytest ... \| tail -2` showed 148 errors | The pipe returns `tail`'s exit code, so `&&` carried on; the errors came from Docker Desktop having stopped (test database gone) | Never pipe a gate command into `tail`/`grep` inside an `&&` chain. Write output to a file and check `$?` (or use `set -o pipefail`). If many `db` tests error at once, check `docker info` and `docker start oriflame-test-db` first |
| 2026-10-27 | Long inline `python - <<'EOF'` scripts in the Bash tool failed with "unexpected EOF while looking for matching `'`" | The tool's shell parsing trips on some long heredocs with mixed quotes | Write longer scripts to a file in the scratchpad and run that file |
| 2026-10-27 | A dev-only `<WebVitals />` behind `NODE_ENV === "development"` still shipped its chunk (~3 KB gzip) to every production page | A static import of a `"use client"` module registers a client reference even if it is never rendered | Load dev-only client components with `await import()` behind the build-time `NODE_ENV` check, and confirm by scanning `.next/static/chunks` |
| 2026-10-27 | Lighthouse found CLS 0.87 on `/products` although every skeleton had the right footprint | Content streaming in *above* the page (category nav with a `null` fallback) and short fallbacks pulling the footer into view | Reserve space for every streamed region above the fold and keep `main` at least viewport height. Measure CLS with Lighthouse (Playwright's Chromium via `CHROME_PATH`) before closing performance work |
| 2026-10-27 | Dev-only `<WebVitals />` loaded by `await import()` in the Server Component layout errored under `next dev` ("module factory is not available") | A client component reached through a dynamic import from an RSC module is not registered in the dev client graph | Put the `NODE_ENV` switch in a small client wrapper that uses `next/dynamic(..., { ssr: false })`; production still drops the reporter (scan `.next/static/chunks`). Read the Playwright web-server log, not only the pass count |
| 2026-10-27 | Making a setting stricter in production broke four unrelated tests | Tests set `APP_ENV=production` with test-only defaults that production now rejects | When tightening production validation, grep the tests for `APP_ENV", "production"` and give them production-valid values |
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
