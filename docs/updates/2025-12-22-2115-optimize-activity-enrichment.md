# Title: Optimize unified activity enrichment

Date: 2025-12-22-2115
Author: Codex CLI
Related: N/A
Tags: performance, activity, enrichment

## Summary
- Gate browser/editor enrichment to matching window apps to cut unnecessary overlap scans.
- Replace nested enrichment loops with a sweep over precomputed time ranges.
- Update unit coverage to reflect the gated enrichment behavior.

## Changes
- Added flattened browser/editor app-name helpers in `src/config/app-names.ts` to support fast app detection.
- Reworked `src/services/unified-activity.ts` enrichment to precompute event intervals, sweep overlaps, and only enrich browser/editor windows.
- Updated `tests/unit/services/unified-activity.test.ts` expectations for browser/editor enrichment by app type.
- Hardened `tests/integration/live-mcp-activity.test.ts` to send Accept headers and parse SSE responses.
- Rules consulted: preferences.md (priority 50), planning.md (priority 30), testing.md (priority 25), documentation.md (priority 20) — Rules applied: all.

## Impact
- Faster `aw_get_activity` enrichment for long ranges by avoiding O(n*m) overlap scans.
- Browser/editor enrichment now only appears when the window app matches configured browser/editor names.
- No API schema changes; behavior is more selective for unknown app names.

## Validation
- `npm run test:unit`
- `RUN_LIVE_AW_TESTS=true LOG_LEVEL=DEBUG npx vitest run tests/integration/live-mcp-activity.test.ts`

## Follow-ups / TODOs
- Add any missing browser/editor app names to `config/app-names.json` if enrichment is not appearing for a known app.

## Links
- N/A
