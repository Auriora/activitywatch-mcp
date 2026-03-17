# Title: Stabilize time utility tests across local timezones

Date: 2026-03-17-1420
Author: Codex
Related: Issue #6
Tags: tests, timezone, vitest

## Summary
- Reworked `tests/unit/utils/time.test.ts` so local-boundary helpers no longer assume UTC midnight.
- Replaced brittle ISO-string assertions with local date-part checks for day, week, and month range helpers.
- Confirmed `npm test` passes with `TZ=Asia/Bangkok`, matching the reproduction steps in issue `#6`.

## Changes
- Added a small shared assertion helper in `tests/unit/utils/time.test.ts` for validating local date parts.
- Updated range and boundary tests to assert local calendar semantics instead of fixed UTC timestamps.
- Switched `getDaysBetween` and `getWeeksBetween` fixtures to local `Date` constructors where the behavior under test is local-day based.

## Impact
- Non-breaking change limited to test coverage.
- Test runs are now stable across developer machines in non-UTC timezones.
- Preserves the implementation's documented local-time behavior instead of forcing UTC-only expectations.

## Validation
- `TZ=UTC npm run test:unit -- tests/unit/utils/time.test.ts`
- `TZ=Asia/Bangkok npm run test:unit -- tests/unit/utils/time.test.ts`
- `TZ=Asia/Bangkok npm test`

## Follow-ups / TODOs
- Consider adding a dedicated CI matrix job for one non-UTC timezone to catch similar regressions earlier.

## Links
- Issue: `#6`
- Rules consulted: `preferences.md` (priority 50), `testing.md` (priority 25), `documentation.md` (priority 20)
- Rules applied: timezone-safe test placement/conventions, required `docs/updates` entry and index update
- Overrides: none
