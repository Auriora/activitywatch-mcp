# Title: Gate unified activity suggestions on window tracking

Date: 2026-03-17-1510
Author: Codex
Related: PR #7 review comment
Tags: capabilities, tools, tests

## Summary
- Updated suggested tool selection so `aw_get_activity` is only recommended when window tracking is available.
- Kept `aw_get_period_summary` available for browser/editor-only setups because it can still summarize non-window activity data.
- Added unit coverage for the browser/editor-only capability mix.

## Changes
- Updated `src/services/capabilities.ts` to gate `aw_get_activity` on `capabilities.has_window_tracking`.
- Split activity-tool and summary-tool eligibility so browser/editor-only environments still get `aw_get_period_summary`.
- Added a unit test in `tests/unit/services/capabilities.test.ts` covering the browser/editor-only suggested-tools case.

## Impact
- Prevents recommending a tool that relies on canonical window timelines when only enrichment buckets exist.
- Reduces the chance of empty `aw_get_activity` results in partial ActivityWatch setups.

## Validation
- `npm test -- tests/unit/services/capabilities.test.ts`
- `npm run build`

## Follow-ups / TODOs
- Consider adding a capability-level hint explaining why `aw_get_activity` is omitted when only browser/editor buckets are present.

## Links
- PR: `#7`
- Rules consulted: `AGENTS.md` top-level repository guidance
- Rules applied: add `docs/updates` note and index entry, include targeted test coverage
- Overrides: none
