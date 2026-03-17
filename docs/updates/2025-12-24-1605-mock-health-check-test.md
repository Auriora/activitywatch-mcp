# Title: Mock health check in HTTP integration tests

Date: 2025-12-24-1605
Author: Codex CLI
Related: N/A
Tags: tests, http

## Summary
- Mocked the ActivityWatch health check during HTTP integration tests to avoid external dependencies.
- Prevented /health endpoint timeouts when ActivityWatch is unavailable.
- Kept the health endpoint expectations intact while using stubbed results.

## Changes
- Added a `vi.mock` for `performHealthCheck` and `logStartupDiagnostics` in `tests/integration/http-server.test.ts`.
- Ensured the mocked health result returns a healthy payload for the /health endpoint.
- Rules consulted: preferences.md (priority 50), testing.md (priority 25), documentation.md (priority 20). Rules applied: same. Overrides: none.

## Impact
- Non-breaking test-only change; improves CI reliability for HTTP integration tests.
- Removes dependency on a reachable ActivityWatch server for the /health test.

## Validation
- `npm run test:integration`

## Follow-ups / TODOs
- None.

## Links
- N/A
