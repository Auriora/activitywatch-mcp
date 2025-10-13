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

#### Tools
- `aw_get_window_activity` - Application/window usage analysis
- `aw_get_web_activity` - Browser/website usage analysis  
- `aw_get_editor_activity` - IDE/editor usage analysis

#### Services
- `src/services/window-activity.ts`
- `src/services/web-activity.ts`
- `src/services/editor-activity.ts`

#### Schemas
- `GetWindowActivitySchema`
- `GetWebActivitySchema`
- `GetEditorActivitySchema`

#### Types
- `WindowActivityParams`
- `WebActivityParams`
- `EditorActivityParams`

Note: `AppUsage`, `WebUsage`, and `EditorUsage` types were retained as they're still used by `DailySummary`.

### Migration Guide

#### Before (Window Activity)
```typescript
aw_get_window_activity({
  time_period: "today",
  top_n: 10,
  group_by: "application"
})
```

#### After (Unified Activity)
```typescript
aw_get_activity({
  time_period: "today",
  top_n: 10,
  group_by: "application",
  include_browser_details: false,  // Optional: exclude browser enrichment
  include_editor_details: false    // Optional: exclude editor enrichment
})
```

#### Before (Web Activity)
```typescript
aw_get_web_activity({
  time_period: "today",
  top_n: 10,
  group_by: "domain"
})
```

#### After (Unified Activity - Filter to Browser)
```typescript
aw_get_activity({
  time_period: "today",
  top_n: 10,
  group_by: "application"
})
// Then filter results to only activities with browser data
```

Or use `aw_query_events` for advanced filtering:
```typescript
aw_query_events({
  query_type: "browser",
  start_time: "2025-10-11T00:00:00Z",
  end_time: "2025-10-11T23:59:59Z",
  filter_domains: ["github.com"]  // Optional filtering
})
```

#### Before (Editor Activity)
```typescript
aw_get_editor_activity({
  time_period: "today",
  group_by: "project",
  include_git_info: true
})
```

#### After (Unified Activity or Query)
```typescript
// Option 1: Use unified activity (includes editor data when available)
aw_get_activity({
  time_period: "today",
  top_n: 10,
  include_editor_details: true
})

// Option 2: Use query events for editor-specific filtering
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
