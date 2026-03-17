# Title: Address remaining PR 8 review comments

Date: 2026-03-17-1620
Author: Codex
Related: PR #8, Issue #6
Tags: review, capabilities, schemas, tests

## Summary
- Gated suggested high-level activity tools on window tracking so window-dependent flows are no longer recommended when only browser/editor buckets exist.
- Improved custom date validation to attribute parse failures to the specific invalid field instead of always blaming `custom_start`.
- Added focused regression coverage for both review comments.

## Changes
- Updated `src/services/capabilities.ts` to only suggest `aw_get_activity` and `aw_get_period_summary` when window tracking is available.
- Updated `src/tools/schemas.ts` custom range validation helpers to report `custom_start` and `custom_end` parse errors on the correct field.
- Added tests in `tests/unit/services/capabilities.test.ts` and `tests/unit/tools/schemas.test.ts`.

## Impact
- Non-breaking behavior refinement.
- Tool recommendations are now better aligned with what the underlying services can actually return.
- Schema error messages are more precise and actionable for invalid custom date inputs.

## Validation
- `npm run test:unit -- tests/unit/services/capabilities.test.ts tests/unit/tools/schemas.test.ts`
- `npm run build`

## Follow-ups / TODOs
- If PR `#8` stays open, resolve the corresponding GitHub review threads after pushing these changes.

## Links
- PR: `#8`
- Issue: `#6`
- Rules consulted: `preferences.md` (priority 50), `testing.md` (priority 25), `documentation.md` (priority 20)
- Rules applied: targeted regression tests, required `docs/updates` entry and index update
- Overrides: none
