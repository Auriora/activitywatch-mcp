# Title: Calendar data surfaced via aw_get_calendar_events

Date: 2025-10-12-1232
Author: AI Agent
Related:
Tags: tools

## Summary
- Added calendar awareness so aw-import-ical buckets are detected and surfaced through a dedicated MCP tool.
- End users can ask for meetings without AFK suppression; calendar time is ORed with activity during summaries.
- Introduced CalendarService, formatter updates, and tests to protect normalization logic. Rules consulted: preferences.md (priority 50), planning.md (priority 30).

## Changes


- Added `has_calendar_events` capability detection, new calendar bucket lookup, and tool suggestion wiring.
- Implemented `CalendarService`, extended the MCP server with `aw_get_calendar_events`, and enriched period summaries with notable meetings.
- Documented the tool in README and docs/reference/tools.md, plus added a docs/updates index entry.

## Impact
- ✅ New calendar responses in MCP outputs (concise, detailed, raw) with attendee and location metadata.
- ✅ Period summaries now highlight notable meetings even when AFK classified the user as away.
- ⚠️ Calendar detection depends on aw-import-ical buckets; tool gracefully errors when absent.

## Validation
- `npm run test:unit`
- `npm run test:integration`

## Follow-ups / TODOs
- Consider unioning calendar intervals with unified activity metrics for richer analytics.
- Expand formatter examples once real data samples are available.

## Links
- src/services/calendar.ts
- src/tools/definitions.ts
- docs/reference/tools.md
- docs/updates/index.md
