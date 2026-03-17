# Title: Align tool docs and schemas with timezone semantics

Date: 2026-03-17-1440
Author: Codex
Related: Issue #6
Tags: docs, schemas, timezone, validation

## Summary
- Updated tool descriptions and reference docs to explain local-midnight semantics for bare `YYYY-MM-DD` dates.
- Clarified that period presets use local calendar boundaries and that IANA timezone offsets are resolved for the requested period date.
- Aligned schema validation with runtime parsing so custom date checks no longer use UTC-only `new Date(...)` behavior.

## Changes
- Updated `src/tools/definitions.ts` wording for `aw_get_activity`, `aw_get_period_summary`, and `aw_get_calendar_events`.
- Updated `src/tools/schemas.ts` descriptions and custom-range validation to use `parseDate`.
- Updated `docs/reference/tools.md` parameter tables and common time-period reference.

## Impact
- Non-breaking documentation/schema refinement.
- Reduces ambiguity for users and agents when specifying custom date ranges.
- Prevents schema validation from disagreeing with runtime parsing on bare dates.

## Validation
- `npm run test:unit -- tests/unit/tools/schemas.test.ts tests/unit/utils/timezone.test.ts tests/unit/utils/time.test.ts`
- `npm run build`

## Follow-ups / TODOs
- Consider adding one or two explicit custom-date examples in `docs/getting-started/quickstart.md` to reinforce inclusive end-of-day guidance.

## Links
- Issue: `#6`
- Rules consulted: `preferences.md` (priority 50), `testing.md` (priority 25), `documentation.md` (priority 20)
- Rules applied: schema/runtime alignment, required `docs/updates` entry and index update
- Overrides: none
