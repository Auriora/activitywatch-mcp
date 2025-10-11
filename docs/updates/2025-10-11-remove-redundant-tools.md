# Remove Redundant Activity Tools

**Date:** October 11, 2025  
**Type:** Breaking Change  
**Impact:** Tool removal, API simplification

## Summary

Removed three redundant activity analysis tools (`aw_get_window_activity`, `aw_get_web_activity`, `aw_get_editor_activity`) in favor of the unified `aw_get_activity` tool, which provides all their functionality plus enrichment.

## Rationale

The specialized tools were redundant because:

1. **`aw_get_activity` is a superset**: It uses canonical events that combine window + browser + editor data with intelligent enrichment
2. **No unique functionality**: The specialized tools only queried narrower data sets without providing any unique capabilities
3. **Better user experience**: `aw_get_activity` provides more context (e.g., shows both Chrome usage AND which websites were visited)
4. **Simpler API**: Fewer tools to choose from reduces cognitive load

## What Was Removed

### Tools
- `aw_get_window_activity` - Application/window usage analysis
- `aw_get_web_activity` - Browser/website usage analysis  
- `aw_get_editor_activity` - IDE/editor usage analysis

### Services
- `src/services/window-activity.ts`
- `src/services/web-activity.ts`
- `src/services/editor-activity.ts`

### Schemas
- `GetWindowActivitySchema`
- `GetWebActivitySchema`
- `GetEditorActivitySchema`

### Types
- `WindowActivityParams`
- `WebActivityParams`
- `EditorActivityParams`

Note: `AppUsage`, `WebUsage`, and `EditorUsage` types were retained as they're still used by `DailySummary`.

## Migration Guide

### Before (Window Activity)
```typescript
aw_get_window_activity({
  time_period: "today",
  top_n: 10,
  group_by: "application"
})
```

### After (Unified Activity)
```typescript
aw_get_activity({
  time_period: "today",
  top_n: 10,
  group_by: "application",
  include_browser_details: false,  // Optional: exclude browser enrichment
  include_editor_details: false    // Optional: exclude editor enrichment
})
```

### Before (Web Activity)
```typescript
aw_get_web_activity({
  time_period: "today",
  top_n: 10,
  group_by: "domain"
})
```

### After (Unified Activity - Filter to Browser)
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

### Before (Editor Activity)
```typescript
aw_get_editor_activity({
  time_period: "today",
  group_by: "project",
  include_git_info: true
})
```

### After (Unified Activity or Query)
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

## Benefits

1. **Simpler API**: 3 fewer tools to understand and choose from
2. **Better data**: `aw_get_activity` provides enriched data (e.g., shows Chrome + which websites)
3. **No double-counting**: Canonical events approach prevents inflated metrics
4. **Consistent behavior**: One tool with consistent parameters and behavior
5. **Easier maintenance**: Less code to maintain and test

## Alternatives for Specialized Queries

If you need specialized filtering that `aw_get_activity` doesn't provide:

1. **`aw_query_events`**: Advanced filtering by apps, domains, titles, etc.
2. **`aw_get_raw_events`**: Direct bucket access for debugging or custom analysis

## Internal Changes

### DailySummaryService Refactored
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

## Testing

Verify that:
1. `aw_get_activity` returns expected data with browser and editor enrichment
2. `aw_get_daily_summary` still works correctly (uses refactored service)
3. `aw_query_events` can handle specialized queries
4. No references to removed tools remain in codebase

## Documentation Updated

- `docs/reference/tools.md`: Removed sections for deleted tools, added `aw_query_events`
- Tool overview table updated to reflect new simplified API
- All "WHEN NOT TO USE" sections updated to reference `aw_get_activity` instead of removed tools

## Rules Applied

- **SOLID principles**: Removed redundant code (DRY)
- **Simplicity**: Fewer tools = simpler API
- **User-focused**: Better UX with enriched data from unified tool

