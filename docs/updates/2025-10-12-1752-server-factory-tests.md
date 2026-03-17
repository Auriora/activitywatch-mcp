# Title: Server factory seam and handler coverage

Date: 2025-10-12-1752
Author: AI Agent
Related:
Tags: testing

## Summary
- Added a `createServerWithDependencies` seam so tests can compose the MCP server with mocked services.
- Covered `aw_get_activity`, `aw_get_calendar_events`, `aw_get_period_summary`, and `aw_query_events` handler flows with integration tests.
- Exercised error reporting for missing handlers and validated that mocked ActivityWatch responses surface in tool output.

## Changes

- Extracted dependency wiring in `src/server-factory.ts` into the exported `createServerWithDependencies` helper with optional category/health bootstrapping flags.
- Registered tool handlers against injected services so tests can assert formatter output without touching ActivityWatch.
- Added `tests/integration/server-factory.test.ts` with lightweight mocks for every service dependency plus a `callTool` utility.
- Ensured the factory honours existing logging while skipping category loads/health checks when disabled for tests.

## Impact
- Improves confidence in server wiring and prevents regressions in tool handler dispatch logic.
- Speeds up tests by allowing category loads and health checks to be skipped in non-production scenarios.
- No user-facing behaviour change; stdio and HTTP entrypoints reuse the same factory.

## Validation
- `npm run test:integration -- --run tests/integration/server-factory.test.ts`
- `npm run test:unit`

## Follow-ups / TODOs
- None. HTTP transport lifecycle coverage was added later, and snapshot coverage is not required for the current test strategy.

## Links
- ../developer/test-coverage-expansion-plan.md
- Rules consulted: .agents/rules/preferences.md, .agents/rules/planning.md, .agents/rules/testing.md
