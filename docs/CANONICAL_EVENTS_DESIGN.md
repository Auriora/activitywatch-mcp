# Canonical Events Design - Unified Activity Data

## Problem Statement

The current implementation has three separate tools (`aw_get_window_activity`, `aw_get_web_activity`, `aw_get_editor_activity`) that:

1. **Don't properly correlate data**: Browser/editor activity is counted even when those windows aren't active
2. **Create confusion**: Users don't know which tool to use
3. **Miss enrichment opportunities**: Can't see URL/file details alongside app usage

## Solution: Canonical Events Approach

Follow ActivityWatch's canonical events pattern where:

1. **Window events are the base** - Define when each application was active
2. **Browser/editor events enrich the data** - Only counted when their window is active
3. **AFK filtering applies to everything** - Only "not-afk" periods count

## Data Model

### Unified Activity Event

```typescript
interface ActivityEvent {
  // Base fields (always present)
  app: string;                    // Application name (e.g., "Google Chrome", "VS Code")
  title: string;                  // Window title
  duration_seconds: number;
  duration_hours: number;
  percentage: number;
  
  // Browser enrichment (only when app is a browser AND window was active)
  browser?: {
    url: string;                  // Full URL
    domain: string;               // Extracted domain
    title: string;                // Page title (may differ from window title)
    audible?: boolean;            // Was audio playing
    incognito?: boolean;          // Was incognito mode
  };
  
  // Editor enrichment (only when app is an editor AND window was active)
  editor?: {
    file: string;                 // File path
    project: string;              // Project name
    language: string;             // Programming language
    git?: {
      branch: string;
      commit: string;
      repository: string;
    };
  };
  
  // Category (if categorization enabled)
  category?: string;
  
  // Metadata
  event_count: number;
  first_seen: string;             // ISO 8601 timestamp
  last_seen: string;              // ISO 8601 timestamp
}
```

## Query Structure

### Canonical Query (based on ActivityWatch's implementation)

```javascript
// 1. Get window events (base)
events = flood(query_bucket(find_bucket("aw-watcher-window_")));

// 2. Filter by AFK
not_afk = flood(query_bucket(find_bucket("aw-watcher-afk_")));
not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);
events = filter_period_intersect(events, not_afk);

// 3. Get browser events and filter by active window
browser_events = flood(query_bucket(find_bucket("aw-watcher-web-chrome_")));
window_chrome = filter_keyvals(events, "app", ["Google Chrome", "chrome.exe"]);
browser_events = filter_period_intersect(browser_events, window_chrome);

// 4. Get editor events and filter by active window
editor_events = flood(query_bucket(find_bucket("aw-watcher-vscode_")));
window_vscode = filter_keyvals(events, "app", ["Code", "code.exe"]);
editor_events = filter_period_intersect(editor_events, window_vscode);

// 5. Merge and return
RETURN = events;
```

### Key Insight

The `filter_period_intersect` ensures that:
- Browser events only count when the browser window was active
- Editor events only count when the editor window was active
- Everything is already AFK-filtered

## Implementation Plan

### Phase 1: Update QueryService

Modify `QueryService` to build canonical queries:

```typescript
class QueryService {
  // New method: Get canonical events (window + browser + editor enrichment)
  async getCanonicalEvents(
    startTime: Date,
    endTime: Date
  ): Promise<CanonicalResult> {
    // Build query that:
    // 1. Gets window events (AFK-filtered)
    // 2. Gets browser events (filtered by active browser windows)
    // 3. Gets editor events (filtered by active editor windows)
    // 4. Returns all data for client-side merging
  }
}
```

### Phase 2: Create UnifiedActivityService

Replace separate services with one unified service:

```typescript
class UnifiedActivityService {
  async getActivity(params: ActivityParams): Promise<{
    total_time_seconds: number;
    activities: ActivityEvent[];
    time_range: { start: string; end: string };
  }> {
    // 1. Get canonical events from QueryService
    // 2. Merge browser/editor data into window events
    // 3. Group and aggregate
    // 4. Return unified results
  }
}
```

### Phase 3: Update Tool Definition

Simplify to one primary tool:

```typescript
{
  name: 'aw_get_activity',
  description: `Analyzes computer activity over a time period.
  
  Returns unified activity data with:
  - Application usage (always included)
  - Browser details (when browsing, only for active browser windows)
  - Editor details (when coding, only for active editor windows)
  - All data is AFK-filtered (only active time counted)
  `,
  // ... parameters
}
```

## Data Merging Strategy

### Client-Side Merging

After getting events from the query:

1. **Index browser events by timestamp**
   ```typescript
   const browserEventsByTime = new Map<string, BrowserEvent>();
   ```

2. **Index editor events by timestamp**
   ```typescript
   const editorEventsByTime = new Map<string, EditorEvent>();
   ```

3. **Enrich window events**
   ```typescript
   for (const windowEvent of windowEvents) {
     const enriched: ActivityEvent = {
       ...windowEvent,
       browser: findOverlappingBrowserEvent(windowEvent, browserEventsByTime),
       editor: findOverlappingEditorEvent(windowEvent, editorEventsByTime),
     };
   }
   ```

### Grouping Strategy

Group by application, but preserve enrichment:

```typescript
// Group by app
const groups = new Map<string, ActivityEvent[]>();

// For each group, aggregate:
// - Total duration (sum)
// - Browser URLs (collect unique)
// - Editor files (collect unique)
// - etc.
```

## Benefits

### 1. Accurate Data
- Browser activity only counted when browser window is active
- Editor activity only counted when editor window is active
- No double-counting or inflation

### 2. Rich Context
- See what you were browsing while using Chrome
- See what files you were editing while using VS Code
- All in one unified view

### 3. Simpler API
- One tool instead of three
- Less confusion for users
- Easier to understand results

### 4. Consistent with ActivityWatch
- Uses same canonical events approach as web UI
- Results match what users see in dashboard
- Leverages proven query patterns

## Example Output

```json
{
  "total_time_seconds": 7200,
  "activities": [
    {
      "app": "Google Chrome",
      "title": "Various",
      "duration_seconds": 3600,
      "duration_hours": 1.0,
      "percentage": 50,
      "browser": {
        "domain": "github.com",
        "url": "https://github.com/ActivityWatch/activitywatch",
        "title": "ActivityWatch - GitHub"
      },
      "event_count": 45,
      "first_seen": "2025-10-10T09:00:00Z",
      "last_seen": "2025-10-10T10:00:00Z"
    },
    {
      "app": "VS Code",
      "title": "activitywatcher-mcp",
      "duration_seconds": 2700,
      "duration_hours": 0.75,
      "percentage": 37.5,
      "editor": {
        "file": "src/services/query.ts",
        "project": "activitywatcher-mcp",
        "language": "TypeScript",
        "git": {
          "branch": "main",
          "repository": "https://github.com/user/activitywatcher-mcp"
        }
      },
      "event_count": 32,
      "first_seen": "2025-10-10T10:00:00Z",
      "last_seen": "2025-10-10T10:45:00Z"
    }
  ],
  "time_range": {
    "start": "2025-10-10T09:00:00Z",
    "end": "2025-10-10T11:00:00Z"
  }
}
```

## Migration Path

### Option 1: Replace Existing Tools
- Remove `aw_get_window_activity`, `aw_get_web_activity`, `aw_get_editor_activity`
- Add new `aw_get_activity` with unified data
- **Breaking change** but cleaner API

### Option 2: Keep Compatibility
- Keep existing tools for backward compatibility
- Add new `aw_get_activity` as recommended tool
- Deprecate old tools over time
- **Non-breaking** but more maintenance

### Recommendation: Option 1
- Cleaner, simpler API
- Less confusion
- Better user experience
- MCP is new, breaking changes acceptable

## Implementation Status

1. ✅ Research canonical events approach
2. ✅ Design unified data model
3. ✅ Implement canonical query in QueryService
4. ✅ Create UnifiedActivityService
5. ✅ Update tool definitions
6. ⏳ Test with real data
7. ⏳ Update documentation

## Implementation Complete

The canonical events approach has been fully implemented:

### Files Created/Modified

1. **src/types.ts** - Added canonical event types:
   - `BrowserEnrichment` - Browser data structure
   - `EditorEnrichment` - Editor data structure
   - `CanonicalEvent` - Unified activity event
   - `CanonicalQueryResult` - Query result structure
   - `UnifiedActivityParams` - Tool parameters

2. **src/services/query.ts** - Enhanced with canonical queries:
   - `getCanonicalEvents()` - Main method for fetching canonical events
   - `buildCanonicalBrowserQuery()` - Filters browser events by active window
   - `buildCanonicalEditorQuery()` - Filters editor events by active window
   - `detectBrowserType()` - Identifies browser from bucket ID
   - `detectEditorType()` - Identifies editor from bucket ID
   - Browser/editor app name mappings

3. **src/services/unified-activity.ts** - New unified service:
   - `getActivity()` - Main method for unified activity analysis
   - `enrichWindowEvents()` - Merges browser/editor data into window events
   - `extractBrowserData()` - Extracts browser enrichment
   - `extractEditorData()` - Extracts editor enrichment
   - `groupEvents()` - Groups and aggregates enriched events
   - `applyCategories()` - Applies category classification

4. **src/index.ts** - Added new tool:
   - `aw_get_activity` - New unified activity tool
   - Handler with concise and detailed formatting
   - Integrated UnifiedActivityService

### How It Works

```
User Request
    ↓
aw_get_activity tool
    ↓
UnifiedActivityService.getActivity()
    ↓
QueryService.getCanonicalEvents()
    ↓
ActivityWatch Query API
    ├─ Window events (AFK-filtered)
    ├─ Browser events (filtered by active browser window)
    └─ Editor events (filtered by active editor window)
    ↓
UnifiedActivityService.enrichWindowEvents()
    ├─ Index browser events by timestamp
    ├─ Index editor events by timestamp
    └─ Merge into window events
    ↓
Group, aggregate, categorize
    ↓
Return enriched activity data
```

### Key Features

1. **Window-Based Filtering**: Browser and editor events are filtered using `filter_period_intersect` to only include periods when their windows were active

2. **No Double-Counting**: Each second of activity is counted once, even if multiple data sources exist

3. **Rich Enrichment**: Window events are enriched with:
   - Browser URLs and domains (when browsing)
   - Editor files and projects (when coding)
   - Categories (when configured)

4. **Graceful Degradation**: Works even if browser or editor tracking is unavailable

### Example Query

```javascript
// Get window events (AFK-filtered)
window_events = query_bucket("aw-watcher-window_hostname");
afk_events = query_bucket("aw-watcher-afk_hostname");
not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);
window_events = filter_period_intersect(window_events, not_afk);

// Filter to only Chrome windows
browser_windows = filter_keyvals(window_events, "app", ["Google Chrome", "chrome.exe"]);

// Get browser events
browser_events = query_bucket("aw-watcher-web-chrome_hostname");

// Filter browser events to only when Chrome window was active
events = filter_period_intersect(browser_events, browser_windows);
```

### Next Steps

1. Test with real ActivityWatch data
2. Update IMPLEMENTATION.md and ACTIVITYWATCH_INTEGRATION.md
3. Create user guide for the new tool
4. Consider deprecating old separate tools

