# Title: Add configurable ActivityWatch timeout and canonical query chunking

Date: 2025-12-23-1530
Author: Codex (GPT-5)
Related: Issue (user request)
Tags: timeout, chunking, activitywatch, config, tests

## Summary
- Added environment-configured ActivityWatch request timeouts and chunking controls for canonical queries.
- Large-range `aw_get_activity` calls now split into smaller segments to reduce timeout risk.
- Updated developer docs and sample configs; added unit coverage for runtime config and chunking behavior.

## Changes
- Added `src/config/runtime.ts` for `AW_TIMEOUT_MS` and `AW_QUERY_CHUNK_DAYS` parsing.
- `QueryService` now chunks canonical queries when ranges exceed configured chunk size.
- `createMCPServer` and health checks pass configured timeout to the ActivityWatch client.
- Docs updated in `docs/developer/http-server-development.md`, `docs/developer/logging-and-health.md`, and `docs/developer/docker.md`.
- Sample configs updated to include new environment variables.
- Rules consulted: preferences.md (priority 50), planning.md (priority 30), testing.md (priority 25), documentation.md (priority 20) — Rules applied: preferences.md, planning.md, testing.md, documentation.md — Overrides: none.

## Impact
- Reduces timeout risk for long activity ranges without changing tool signatures.
- Adds two optional env flags: `AW_TIMEOUT_MS` (default 30000) and `AW_QUERY_CHUNK_DAYS` (default 7).
- Slightly higher API call volume for large ranges due to chunking.

## Validation
- Added unit tests: `tests/unit/config/runtime.test.ts`, `tests/unit/services/query.test.ts`.
- `npm run test:unit`

## Follow-ups / TODOs
- Consider exposing chunk size and timeout settings in a dedicated config doc reference table.
- Evaluate whether canonical chunking should also apply to other query types if timeouts persist.

## Links
- N/A
