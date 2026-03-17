# Title: Add live activity test coverage and timing logs

Date: 2025-12-22-1830
Author: AI Agent
Related: 
Tags: tests, logging

## Summary
- Added stage-level timing logs to the unified activity pipeline to aid hang/debug analysis.
- Added opt-in live integration tests for heavy groupings using real ActivityWatch data.
- Kept default test runs unchanged by gating live tests behind an env flag.

## Changes
- Added per-stage timing logs in `src/services/unified-activity.ts` (canonical fetch, enrichment, overlay, grouping, sorting).
- Added `tests/integration/live-activity.test.ts` guarded by `RUN_LIVE_AW_TESTS=true` and `AW_URL`.
- Added `tests/integration/live-mcp-activity.test.ts` to exercise MCP HTTP tool calls against live data.
- Rules consulted: preferences.md (priority 50), documentation.md (priority 20), testing.md (priority 25). Rules applied: same. Overrides: none.

## Impact
- Improves observability for hang/timeout investigations.
- Provides regression coverage for expensive groupings using live data (opt-in).

## Validation
- `npm run test:integration` (default run; live tests skipped unless `RUN_LIVE_AW_TESTS=true`).
- `RUN_LIVE_AW_TESTS=true AW_URL=http://localhost:5600 npm run test:integration` (live tests hit timeout on `live-activity.test.ts` with `group_by=project` after 30s; reproduces the hang).

## Follow-ups / TODOs
- Consider adding perf thresholds to CI if a stable ActivityWatch fixture becomes available.

## Links
- N/A
