# Title: Remove Redundant Activity Tools

Date: 2025-10-11-0621
Author: AI Agent
Related:
Tags: tools

## Summary
- Removed the redundant window, web, and editor activity tools in favour of the unified `aw_get_activity` endpoint.
- Refactored dependent services (notably `DailySummaryService`) to rely on canonical events from `UnifiedActivityService`.
- Updated tool documentation and migration guidance so users know how to replace specialised queries.

## Changes
- Deleted the three redundant tool definitions plus their schemas, services, and types.
- Updated `DailySummaryService` to compose results via `UnifiedActivityService` and `QueryService`.
- Refreshed docs to highlight `aw_get_activity`, `aw_query_events`, and `aw_get_raw_events` as the supported paths.

### Rationale

The specialized tools were redundant because:

1. **`aw_get_activity` is a superset**: It uses canonical events that combine window + browser + editor data with intelligent enrichment
2. **No unique functionality**: The specialized tools only queried narrower data sets without providing any unique capabilities
3. **Better user experience**: `aw_get_activity` provides more context (e.g., shows both Chrome usage AND which websites were visited)
4. **Simpler API**: Fewer tools to choose from reduces cognitive load

### What Was Removed

- Legacy per-surface activity tools (window/web/editor) and their supporting services, schemas, and types.
- Shared usage types remained where still needed for summaries.

### Migration Guide

Use `aw_get_activity` for unified analysis, then focus with grouping and filters:

```typescript
aw_get_activity({
  time_period: "today",
  top_n: 10,
  group_by: "application"
})
```

For domain-specific or editor-specific filtering, use `aw_query_events`:

```typescript
aw_query_events({
  query_type: "browser",
  start_time: "2025-10-11T00:00:00Z",
  end_time: "2025-10-11T23:59:59Z",
  filter_domains: ["github.com"]
})
```

```typescript
aw_query_events({
  query_type: "editor",
  start_time: "2025-10-11T00:00:00Z",
  end_time: "2025-10-11T23:59:59Z"
})
```

### Alternatives for Specialized Queries

If you need specialized filtering that `aw_get_activity` doesn't provide:

1. **`aw_query_events`**: Advanced filtering by apps, domains, titles, etc.
2. **`aw_get_raw_events`**: Direct bucket access for debugging or custom analysis

### Internal Changes

#### DailySummaryService Refactored
The `DailySummaryService` was refactored to use `UnifiedActivityService` instead of the removed services:

**Before:**
```typescript
constructor(
  private windowService: WindowActivityService,
  private webService: WebActivityService,
  private afkService: AfkActivityService,
  private categoryService?: CategoryService
)
```

**After:**
```typescript
constructor(
  private unifiedService: UnifiedActivityService,
  private queryService: QueryService,
  private afkService: AfkActivityService,
  private categoryService?: CategoryService
)
```

The service now:
- Calls `unifiedService.getActivity()` once to get all activity data
- Extracts top applications from all activities
- Extracts top websites from activities with browser data
- Uses `queryService.getAllEventsFiltered()` for categorization

### Rules Applied

- **SOLID principles**: Removed redundant code (DRY)
- **Simplicity**: Fewer tools = simpler API
- **User-focused**: Better UX with enriched data from unified tool

## Impact
- Simplifies the API surface by relying on a single enriched activity tool.
- Prevents double-counting because canonical events now power every consumer.
- Reduces maintenance overhead by eliminating duplicate schemas and services.

## Validation
- `aw_get_activity` manual checks confirm browser/editor enrichment remains available.
- `aw_get_daily_summary` regression test run to ensure refactored service still aggregates correctly.
- Spot-check `aw_query_events` to confirm advanced filtering covers specialist use cases.
- Verified repository search to ensure no lingering references to removed tools.

## Follow-ups / TODOs
- None.

## Links
- docs/reference/tools.md
- docs/concepts/categories.md
- src/services/daily-summary.ts
