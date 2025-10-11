# Simplify aw_get_activity Parameters

**Date**: 2025-10-11  
**Type**: Enhancement  
**Status**: Completed

## Summary

Simplified the `aw_get_activity` tool parameters by:
1. Always including categories (no parameter needed)
2. Removing `include_browser_details` and `include_editor_details` parameters
3. Controlling browser/editor detail display via `response_format` parameter
4. Documenting the existing `group_by: 'category'` option

## Changes Made

### 1. Removed Parameters

The following parameters have been removed from `aw_get_activity`:
- `include_browser_details` (boolean)
- `include_editor_details` (boolean)
- `include_categories` (boolean)

### 2. Updated Behavior

**Categories**:
- Categories are now **always applied** when configured in ActivityWatch
- No parameter needed to enable category classification
- Categories appear in both concise and detailed formats

**Browser/Editor Details**:
- Browser and editor enrichment data is **always collected** internally
- Display is controlled by the `response_format` parameter:
  - `concise`: Shows only app name, time, category, and event count
  - `detailed`: Shows full JSON including browser/editor enrichment

### 3. Group By Category

The `group_by` parameter already supports `'category'` option:
- When `group_by: 'category'`, events are grouped by their category
- Events can appear in **multiple categories** if they match multiple rules
- Uncategorized events appear in a special "Uncategorized" group

## Migration Guide

### Before
```json
{
  "time_period": "today",
  "include_browser_details": true,
  "include_editor_details": true,
  "include_categories": true,
  "response_format": "concise"
}
```

### After
```json
{
  "time_period": "today",
  "response_format": "detailed"
}
```

**Notes**:
- Categories are always included (no parameter needed)
- Use `response_format: "detailed"` to see browser/editor details
- Use `response_format: "concise"` for basic summary without enrichment

## Examples

### Concise Format (Default)
```json
{
  "time_period": "today"
}
```

**Output**:
```
# Activity Summary
**Period**: today
**Total Active Time**: 6.50 hours

## Top 10 Activities

### Google Chrome
- **Time**: 3.25h (50.0%)
- **Category**: Work > Research
- **Events**: 45

### Visual Studio Code
- **Time**: 2.00h (30.8%)
- **Category**: Work > Development
- **Events**: 32
```

### Detailed Format
```json
{
  "time_period": "today",
  "response_format": "detailed"
}
```

**Output**:
```json
{
  "total_time_seconds": 23400,
  "activities": [
    {
      "app": "Google Chrome",
      "title": "Various",
      "duration_seconds": 11700,
      "duration_hours": 3.25,
      "percentage": 50.0,
      "browser": {
        "url": "https://github.com/ActivityWatch/activitywatch",
        "domain": "github.com",
        "title": "ActivityWatch - GitHub"
      },
      "category": "Work > Research",
      "event_count": 45,
      "first_seen": "2025-10-11T09:00:00Z",
      "last_seen": "2025-10-11T15:30:00Z"
    }
  ],
  "time_range": {
    "start": "2025-10-11T00:00:00Z",
    "end": "2025-10-11T23:59:59Z"
  }
}
```

### Group By Category
```json
{
  "time_period": "today",
  "group_by": "category",
  "response_format": "detailed"
}
```

**Output**:
```json
{
  "total_time_seconds": 23400,
  "activities": [
    {
      "app": "3 apps",
      "title": "Various",
      "duration_seconds": 15000,
      "duration_hours": 4.17,
      "percentage": 64.1,
      "category": "Work > Development",
      "event_count": 78
    },
    {
      "app": "2 apps",
      "title": "Various",
      "duration_seconds": 8400,
      "duration_hours": 2.33,
      "percentage": 35.9,
      "category": "Work > Research",
      "event_count": 42
    }
  ]
}
```

## Implementation Details

### Files Modified

1. **src/index.ts**
   - Updated tool description for `aw_get_activity`
   - Updated `response_format` description
   - Removed browser/editor detail parameters from schema
   - Updated concise formatting to exclude browser/editor details

2. **src/services/unified-activity.ts**
   - Already had category application logic (line 109)
   - Already had category grouping logic (lines 289-305)
   - Browser/editor enrichment already collected regardless of parameters

3. **tests/e2e/mcp-server.test.ts**
   - Removed deprecated parameters from test cases

4. **src/services/daily-summary.ts**
   - Removed `include_browser_details` parameter from unified activity call

5. **docs/reference/tools.md**
   - Updated parameter table
   - Updated return type documentation
   - Updated examples

6. **README.md**
   - Updated parameter list
   - Added new examples

## Benefits

1. **Simpler API**: Fewer parameters to understand and configure
2. **Consistent Behavior**: Categories always available when configured
3. **Clear Separation**: `response_format` clearly controls detail level
4. **No Breaking Changes**: Existing code continues to work (parameters ignored)
5. **Better Defaults**: Concise format is cleaner without enrichment details

## Testing

Run the following tests to verify:

```bash
# Run E2E tests
npm test

# Test concise format
aw_get_activity({ time_period: "today" })

# Test detailed format
aw_get_activity({ time_period: "today", response_format: "detailed" })

# Test category grouping
aw_get_activity({ time_period: "today", group_by: "category" })
```

## Related Documentation

- [Tools Reference](../reference/tools.md)
- [Canonical Events Summary](../archive/CANONICAL_EVENTS_SUMMARY.md)
- [Changes Summary](../archive/CHANGES_SUMMARY.md)

