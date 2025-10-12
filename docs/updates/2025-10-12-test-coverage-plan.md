# Title: Test Coverage Expansion Plan

Date: 2025-10-12
Author: AI Agent (Codex)
Related: Issue # (TBD)
Tags: testing, coverage, planning

## Summary
- Outline staged additions to unit, integration, and HTTP transport tests raised in recent coverage review.
- Clarify expected coverage gains and risk focus to guide implementation prioritisation.
- Record coordination notes so follow-up work stays aligned with repository testing guidelines.

## Changes
- Document the sequencing for new specs across `src/client`, `src/services`, `src/utils`, and transport layers.
- Capture dependencies on shared helpers and any required refactors (e.g. injectable clients).
- Note documentation and tooling updates required alongside test additions.

## Impact
- Improves visibility into planned test work; no runtime code impact yet.
- Anticipated coverage increase once tasks complete (statements >60 %, key services >80 %).
- Highlights need for optional refactors but defers execution until agreed.

## Validation
- No code changes in this commit; validation occurs as each task lands.
- Future PRs should include `npm run test` and `npm run test:coverage` confirmations.

## Follow-ups / TODOs
1. **ActivityWatch client tests**: add fetch stubs exercising success, HTTP error, timeout, and connection failures (`src/client/activitywatch.ts`).
2. **Server factory tooling**: create injectable server factory or dependency seam, then cover `aw_get_*` handlers including concise/detailed formatting branches (`src/server-factory.ts`).
3. **HTTP transport lifecycle**: expose factory to allow supertest coverage of `/health`, session reuse, and reset paths (`src/http-server.ts`).
4. **Health utilities**: unit test `performHealthCheck` happy path, unreachable server, and missing watcher combinations; add snapshot-style expectations for `formatHealthCheckResult` (`src/utils/health.ts`).
5. **Formatter coverage**: table-driven tests for concise/detailed outputs (`src/utils/formatters.ts`).
6. **Schema validation**: verify `TimePeriodSchema` custom range requirements and field defaults (`src/tools/schemas.ts`).
7. **Service gaps**: extend unit specs for `QueryService`, `CategoryService`, and `AfkActivityService` using enhanced mock client support.
8. **Helper enhancements**: update `tests/helpers/mock-client.ts` to produce `AWError` and timeout scenarios; share utilities for repeated stubs.
9. **Documentation**: update `tests/README.md` and `testing.md` (if applicable) once new suites are in place.

## Links
- Coverage review summary (internal discussion, pending issue link).
- Repository testing guidelines (`tests/README.md`).
