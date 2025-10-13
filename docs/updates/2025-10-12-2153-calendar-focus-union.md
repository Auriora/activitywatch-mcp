# Title: Calendar-fused focus metrics in unified activity

Date: 2025-10-12-2153
Author: AI Agent
Related:
Tags: tools

## Summary
- Unified activity now blends calendar meetings with focus time, adding meeting metadata to window events and emitting calendar-only segments.
- Totals distinguish focus vs meeting hours while avoiding double-counting overlaps; period summaries report the split explicitly.
- Added interval helpers, unit tests, and formatter updates. Rules consulted: preferences.md (priority 50), planning.md (priority 30).

## Changes
- Extended `UnifiedActivityService` with calendar overlay logic, meeting-only events, and `calendar_summary` output.
- Updated period summaries, CLI formatting, and tools (`aw_get_activity`, `aw_get_period_summary`) to surface focus/meeting metrics.
- Documented the behavior, added interval utilities, and expanded unit coverage for overlay math.

## Impact
- ✅ Meetings override AFK status while keeping focus totals accurate.
- ✅ `aw_get_activity` concise output lists focus vs meeting hours and exposes calendar metadata.
- ✅ Period summaries now show focus and meeting hours separately.

## Validation
- `npm run test:unit`
- `npm run test:integration`

## Follow-ups / TODOs
- Consider exposing calendar overlap analytics (e.g., meeting density) in insights.
- Evaluate caching calendar fetches to reduce repeated API calls for large ranges.

## Links
- src/services/unified-activity.ts
- src/services/period-summary.ts
- src/utils/intervals.ts
