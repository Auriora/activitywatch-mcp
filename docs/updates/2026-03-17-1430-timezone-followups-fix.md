# Title: Fix custom date parsing and DST-sensitive timezone offsets

Date: 2026-03-17-1430
Author: Codex
Related: Issue #6
Tags: timezone, dates, tests, period-summary

## Summary
- Fixed bare `YYYY-MM-DD` parsing so custom date ranges now resolve to local midnight instead of UTC midnight.
- Made IANA timezone offsets date-aware so DST-sensitive periods use the correct offset for the requested date.
- Tightened timezone tests to cover zero-offset aliases, bare-date parsing, and Dublin winter/summer offset changes.

## Changes
- Updated `src/utils/time.ts` to parse bare dates before generic ISO parsing and to compute IANA offsets from a provided reference date.
- Extended `src/config/user-preferences.ts` to accept an optional reference date in `getTimezoneOffset`.
- Updated `src/services/period-summary.ts` to resolve timezone offsets against the requested summary date.
- Added/updated coverage in `tests/unit/utils/timezone.test.ts`, `tests/unit/utils/time.test.ts`, and `tests/unit/config/user-preferences.test.ts`.

## Impact
- Non-breaking API surface change: `getTimezoneOffset` and `parseTimezoneOffset` now accept an optional reference date.
- Custom date ranges behave consistently with local calendar expectations.
- Weekly/monthly summaries in DST-observing IANA timezones now use the correct offset for the period being summarized.

## Validation
- `TZ=UTC npm run test:unit -- tests/unit/utils/timezone.test.ts tests/unit/utils/time.test.ts tests/unit/config/user-preferences.test.ts tests/unit/services/period-summary.test.ts`
- `TZ=Asia/Bangkok npm run test:unit -- tests/unit/utils/timezone.test.ts tests/unit/utils/time.test.ts tests/unit/config/user-preferences.test.ts tests/unit/services/period-summary.test.ts`
- `TZ=Asia/Bangkok npm test`

## Follow-ups / TODOs
- Consider applying date-aware timezone resolution in any future service that accepts IANA timezones plus arbitrary historical/future dates.

## Links
- Issue: `#6`
- Rules consulted: `preferences.md` (priority 50), `testing.md` (priority 25), `documentation.md` (priority 20)
- Rules applied: timezone-safe unit coverage, required `docs/updates` entry and index update
- Overrides: none
