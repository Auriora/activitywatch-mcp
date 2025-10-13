# ActivityWatch MCP - Changes Summary

## Overview
This document summarizes the major improvements made to the ActivityWatch MCP server to address missing IDE/editor activity tracking and add category support to all activity queries.

## Issues Addressed

### 1. IDE Events Not Included in Queries ✅ FIXED
**Problem**: IDE watchers (WebStorm, PyCharm, Obsidian, etc.) use `app.editor.activity` bucket type, which was not being queried by `aw_get_window_activity` or `aw_get_daily_summary`.

**Impact**: 
- Missing potentially hours of coding/editing activity
- Incomplete daily summaries
- No visibility into development work

**Solution**:
- Created new `aw_get_editor_activity` tool for dedicated IDE/editor analysis
- Modified `aw_get_window_activity` to include `app.editor.activity` buckets
- Updated `aw_get_daily_summary` to include editor activity
- Enhanced category matching to work with editor event fields

### 2. Categories Not Returned in Query Results ✅ FIXED
**Problem**: While categories could be configured, they were only returned in `aw_get_daily_summary` and not in individual activity queries.

**Impact**:
- No way to see which category an app/website/project belongs to
- Difficult to analyze activity by category type

**Solution**:
- Added `category` field to `AppUsage`, `WebUsage`, and `EditorUsage` types
- Added `include_categories` parameter to all activity tools
- Category matching now works with window, web, and editor events
- Categories match against all relevant fields (app, title, url, editor, project, file, language)

### 3. Missing Event Metadata ✅ FIXED
**Problem**: Activity queries didn't return useful metadata like event counts.

**Solution**:
- Added `event_count` field to all usage types
- Shows how many individual events contributed to each aggregated item

## New Features

### 1. New Tool: `aw_get_editor_activity`
A dedicated tool for analyzing IDE and editor activity with rich metadata.

**Capabilities**:
- Groups by: `project`, `file`, `language`, or `editor`
- Includes git information (branch, commit, repository)
- Shows file lists, language distribution, project details
- Works with all IDE watchers (JetBrains, VS Code, Obsidian, etc.)

**Example Usage**:
```json
{
  "time_period": "today",
  "group_by": "project",
  "include_git_info": true,
  "include_categories": true,
  "response_format": "detailed"
}
```

**Returns**:
```json
{
  "total_time_seconds": 7200,
  "editors": [
    {
      "name": "activitywatch-mcp",
      "duration_seconds": 3600,
      "duration_hours": 1.0,
      "percentage": 50.0,
      "files": ["index.ts", "types.ts", "schemas.ts"],
      "languages": ["TypeScript"],
      "git_info": {
        "branch": "main",
        "commit": "9ebc8ac",
        "repository": "https://github.com/bcherrington/activitywatch-mcp.git"
      },
      "category": "Work > Programming > ActivityWatch",
      "event_count": 145
    }
  ]
}
```

### 2. Enhanced Category Support
All activity tools now support categories with the `include_categories` parameter.

**Window Activity with Categories (Detailed)**:
```json
{
  "time_period": "today",
  "include_categories": true,
  "response_format": "detailed"
}
```

**Returns**:
```json
{
  "applications": [
    {
      "name": "webstorm",
      "duration_hours": 2.5,
      "percentage": 35.0,
      "category": "Work > Programming > IDEs",
      "event_count": 234,
      "first_seen": "2025-10-10T09:15:23Z",
      "last_seen": "2025-10-10T17:42:11Z",
      "window_titles": [
        "activitywatch-mcp – index.ts",
        "activitywatch-mcp – types.ts"
      ]
    }
  ]
}
```

**Web Activity with Metadata (Detailed)**:
```json
{
  "time_period": "today",
  "response_format": "detailed"
}
```

**Returns**:
```json
{
  "websites": [
    {
      "domain": "youtube.com",
      "duration_hours": 1.2,
      "percentage": 25.0,
      "event_count": 45,
      "first_seen": "2025-10-10T12:30:00Z",
      "last_seen": "2025-10-10T14:15:30Z",
      "audible": true,
      "incognito": false,
      "tab_count_avg": 8.5
    }
  ]
}
```

**Editor Activity with Full Metadata (Detailed)**:
```json
{
  "time_period": "today",
  "group_by": "project",
  "include_git_info": true,
  "include_categories": true,
  "response_format": "detailed"
}
```

**Returns**:
```json
{
  "editors": [
    {
      "name": "activitywatch-mcp",
      "duration_hours": 3.5,
      "percentage": 70.0,
      "category": "Work > Programming > ActivityWatch",
      "event_count": 456,
      "first_seen": "2025-10-10T09:00:00Z",
      "last_seen": "2025-10-10T17:30:00Z",
      "editor_version": "2025.2.3",
      "state_breakdown": {
        "CODING": 8640,
        "DEBUGGING": 2160,
        "BROWSING": 1800
      },
      "files": ["index.ts", "types.ts", "schemas.ts"],
      "languages": ["TypeScript"],
      "git_info": {
        "branch": "main",
        "commit": "9ebc8ac",
        "repository": "https://github.com/bcherrington/activitywatch-mcp.git"
      }
    }
  ]
}
```

### 3. Improved Capabilities Detection
- Added `has_editor_tracking` capability
- Suggests `aw_get_editor_activity` when editor buckets are available
- Better tool recommendations based on available data

## Technical Changes

### Type System Updates
```typescript
// Enhanced usage types with category, event_count, timestamps, and metadata
export interface AppUsage {
  readonly name: string;
  readonly duration_seconds: number;
  readonly duration_hours: number;
  readonly percentage: number;
  readonly window_titles?: readonly string[];
  readonly category?: string;          // NEW
  readonly event_count?: number;       // NEW
  readonly first_seen?: string;        // NEW - ISO 8601 timestamp
  readonly last_seen?: string;         // NEW - ISO 8601 timestamp
}

export interface WebUsage {
  readonly domain: string;
  readonly url?: string;
  readonly title?: string;
  readonly duration_seconds: number;
  readonly duration_hours: number;
  readonly percentage: number;
  readonly category?: string;          // NEW
  readonly event_count?: number;       // NEW
  readonly first_seen?: string;        // NEW - ISO 8601 timestamp
  readonly last_seen?: string;         // NEW - ISO 8601 timestamp
  readonly audible?: boolean;          // NEW - Audio playing
  readonly incognito?: boolean;        // NEW - Incognito mode
  readonly tab_count_avg?: number;     // NEW - Avg tabs open
}

export interface EditorUsage {
  readonly name: string;
  readonly duration_seconds: number;
  readonly duration_hours: number;
  readonly percentage: number;
  readonly projects?: readonly string[];
  readonly files?: readonly string[];
  readonly languages?: readonly string[];
  readonly git_info?: {
    readonly branch?: string;
    readonly commit?: string;
    readonly repository?: string;
  };
  readonly category?: string;          // NEW
  readonly event_count?: number;       // NEW
  readonly first_seen?: string;        // NEW - ISO 8601 timestamp
  readonly last_seen?: string;         // NEW - ISO 8601 timestamp
  readonly editor_version?: string;    // NEW - IDE version
  readonly state_breakdown?: {         // NEW - Time per state
    readonly [state: string]: number;
  };
}
```

### Service Architecture
```
CapabilitiesService
├── findWindowBuckets()    - currentwindow buckets
├── findBrowserBuckets()   - web.tab.current buckets
└── findEditorBuckets()    - app.editor.activity buckets (NEW)

WindowActivityService
├── Now includes editor buckets
├── Handles both 'app' and 'editor' fields
└── Optional CategoryService integration

WebActivityService
└── Optional CategoryService integration

EditorActivityService (NEW)
├── Groups by project/file/language/editor
├── Extracts git metadata
└── Optional CategoryService integration

CategoryService
└── Enhanced to match editor event fields
```

### Event Field Mapping
The services now handle different event types intelligently:

**Window Events**:
- `app` → application name
- `title` → window title

**Web Events**:
- `url` → website URL
- `title` → page title
- `domain` → extracted from URL

**Editor Events**:
- `editor` → IDE name (webstorm, pycharm, etc.)
- `project` → project name
- `file` → filename
- `language` → programming language
- `branch`, `commit`, `sourceUrl` → git metadata

## Migration Guide

### For Existing Users
No breaking changes! All existing queries continue to work as before.

**To enable new features**:
1. Add `include_categories: true` to any activity query to see category information
2. Use `aw_get_editor_activity` to analyze coding activity
3. IDE activity now automatically appears in `aw_get_window_activity` results

### Example Queries

**Before** (missing IDE activity):
```
aw_get_window_activity({ time_period: "today" })
→ Shows: Terminal, Chrome, Firefox
→ Missing: WebStorm, PyCharm, Obsidian
```

**After** (includes IDE activity):
```
aw_get_window_activity({ time_period: "today" })
→ Shows: Terminal, Chrome, Firefox, webstorm, pycharm, Obsidian
```

**New** (dedicated editor analysis):
```
aw_get_editor_activity({ 
  time_period: "today",
  group_by: "project",
  include_git_info: true,
  include_categories: true
})
→ Shows: Projects with files, languages, git info, categories
```

## Testing Recommendations

1. **Test Editor Activity Tool**:
   ```
   aw_get_editor_activity({ time_period: "today" })
   ```
   Should show your IDE/editor usage

2. **Test Window Activity Includes IDEs**:
   ```
   aw_get_window_activity({ time_period: "today" })
   ```
   Should now include IDE names in the results

3. **Test Category Support**:
   ```
   aw_get_window_activity({ 
     time_period: "today",
     include_categories: true 
   })
   ```
   Should show category for each app (if categories configured)

4. **Test Daily Summary**:
   ```
   aw_get_daily_summary({ date: "2025-10-10" })
   ```
   Should show more complete time with IDE activity included

## Performance Considerations

- Category matching adds minimal overhead (only when `include_categories: true`)
- Editor bucket queries are efficient (same as window bucket queries)
- Event count calculation is free (already iterating over events)

## Additional Enhancements (Implemented)

### 4. Timestamp Fields ✅
All usage types now include `first_seen` and `last_seen` timestamps (in detailed mode):
- Shows when an app/website/project was first and last used during the time period
- Helps understand usage patterns and session timing
- ISO 8601 format for easy parsing

### 5. Web-Specific Metadata ✅
`WebUsage` now includes browser-specific fields (in detailed mode):
- `audible`: Whether any visits had audio playing
- `incognito`: Whether any visits were in incognito/private mode
- `tab_count_avg`: Average number of browser tabs open during visits

### 6. Editor-Specific Metadata ✅
`EditorUsage` now includes IDE-specific fields (in detailed mode):
- `editor_version`: IDE version used (e.g., "2025.2.3")
- `state_breakdown`: Time spent in different states (CODING, DEBUGGING, BROWSING, etc.)

## Future Enhancements

Potential improvements for future versions:
- Support filtering by category in queries
- Add category breakdown as separate aggregation option
- Add productivity scoring based on category weights
- Add user-defined tags and notes for activities

