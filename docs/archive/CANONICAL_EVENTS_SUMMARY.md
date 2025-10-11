# Canonical Events Implementation - Summary

## What Changed

The ActivityWatch MCP server now implements **canonical events** - a unified approach to activity tracking that properly combines window, browser, and editor data.

## The Problem We Solved

### Before (Separate Tools)
- `aw_get_window_activity` - Showed app usage
- `aw_get_web_activity` - Showed browsing
- `aw_get_editor_activity` - Showed coding

**Issues:**
1. **Inaccurate data**: Browser/editor activity counted even when windows weren't active
2. **Confusing**: Users didn't know which tool to use
3. **No context**: Couldn't see what you were browsing/coding while using each app

### After (Canonical Events)
- `aw_get_activity` - **One unified tool** with enriched data

**Benefits:**
1. **Accurate**: Browser/editor data only counted when windows were active
2. **Simple**: One tool for all activity analysis
3. **Rich context**: See URLs when browsing, files when coding

## How It Works

### The Canonical Events Pattern

```
1. Window Events (Base Layer)
   ↓
   Defines when each application was active
   Already filtered by AFK status
   
2. Browser Events (Enrichment)
   ↓
   Filtered to only when browser window was active
   Merged into window events
   
3. Editor Events (Enrichment)
   ↓
   Filtered to only when editor window was active
   Merged into window events
   
4. Result: Enriched Activity Data
   ↓
   Window events with browser/editor details when available
```

### Example Query

```javascript
// 1. Get window events (AFK-filtered)
window_events = query_bucket("aw-watcher-window_hostname");
afk_events = query_bucket("aw-watcher-afk_hostname");
not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);
window_events = filter_period_intersect(window_events, not_afk);

// 2. Filter to only Chrome windows
browser_windows = filter_keyvals(window_events, "app", ["Google Chrome"]);

// 3. Get browser events
browser_events = query_bucket("aw-watcher-web-chrome_hostname");

// 4. Filter browser events to only when Chrome was active
events = filter_period_intersect(browser_events, browser_windows);
```

**Key**: `filter_period_intersect` ensures browser events only count when the browser window was active.

## Example Output

### Before (Separate Tools)

```
# Window Activity
- Google Chrome: 2.5 hours

# Web Activity  
- github.com: 2.5 hours  ← Counted even when Chrome wasn't active!
```

### After (Canonical Events)

```json
{
  "app": "Google Chrome",
  "duration_hours": 2.5,
  "percentage": 50,
  "browser": {
    "domain": "github.com",
    "url": "https://github.com/ActivityWatch/activitywatch",
    "title": "ActivityWatch - GitHub"
  },
  "event_count": 45
}
```

**Accurate**: Browser data only included when Chrome window was active.

## New Tool: `aw_get_activity`

### Usage

```typescript
// Get today's activity with browser/editor enrichment
{
  "time_period": "today",
  "top_n": 10,
  "include_browser_details": true,
  "include_editor_details": true
}
```

### Response

```json
{
  "total_time_seconds": 14400,
  "activities": [
    {
      "app": "Google Chrome",
      "title": "Various",
      "duration_hours": 2.5,
      "percentage": 62.5,
      "browser": {
        "domain": "github.com",
        "url": "https://github.com/ActivityWatch/activitywatch"
      },
      "event_count": 45,
      "first_seen": "2025-10-10T09:00:00Z",
      "last_seen": "2025-10-10T11:30:00Z"
    },
    {
      "app": "VS Code",
      "title": "activitywatcher-mcp",
      "duration_hours": 1.5,
      "percentage": 37.5,
      "editor": {
        "file": "src/services/unified-activity.ts",
        "project": "activitywatcher-mcp",
        "language": "TypeScript",
        "git": {
          "branch": "main",
          "repository": "https://github.com/user/activitywatcher-mcp"
        }
      },
      "event_count": 32,
      "first_seen": "2025-10-10T11:30:00Z",
      "last_seen": "2025-10-10T13:00:00Z"
    }
  ],
  "time_range": {
    "start": "2025-10-10T00:00:00Z",
    "end": "2025-10-10T13:00:00Z"
  }
}
```

## Implementation Details

### Files Created/Modified

1. **src/types.ts**
   - Added `BrowserEnrichment`, `EditorEnrichment`, `CanonicalEvent` types
   - Added `CanonicalQueryResult`, `UnifiedActivityParams` types

2. **src/services/query.ts**
   - Added `getCanonicalEvents()` method
   - Added `buildCanonicalBrowserQuery()` - filters browser events by active window
   - Added `buildCanonicalEditorQuery()` - filters editor events by active window
   - Added browser/editor detection logic

3. **src/services/unified-activity.ts** (NEW)
   - `getActivity()` - Main method for unified activity
   - `enrichWindowEvents()` - Merges browser/editor data into window events
   - `groupEvents()` - Groups and aggregates enriched events

4. **src/index.ts**
   - Added `aw_get_activity` tool definition
   - Added handler with concise/detailed formatting

### Key Algorithms

**Window-Based Filtering:**
```typescript
// For each browser bucket:
1. Detect browser type (Chrome, Firefox, etc.)
2. Get matching app names (["Google Chrome", "chrome.exe"])
3. Build query:
   - Get window events (AFK-filtered)
   - Filter to only browser windows
   - Get browser events
   - Intersect browser events with browser windows
4. Result: Browser events only when browser was active
```

**Event Enrichment:**
```typescript
// For each window event:
1. Index browser events by timestamp
2. Index editor events by timestamp
3. For each window event:
   - Look up matching browser event (same timestamp)
   - Look up matching editor event (same timestamp)
   - Merge into enriched event
4. Group by app/title and aggregate
```

## Migration Guide

### For Users

**Old way (3 separate tools):**
```
1. Call aw_get_window_activity → See apps
2. Call aw_get_web_activity → See websites
3. Call aw_get_editor_activity → See coding
4. Manually correlate the data
```

**New way (1 unified tool):**
```
1. Call aw_get_activity → See everything enriched
```

### For Developers

**Old services still available:**
- `WindowActivityService` - Still works, marked as legacy
- `WebActivityService` - Still works, marked as legacy
- `EditorActivityService` - Still works, marked as legacy

**New service:**
- `UnifiedActivityService` - Recommended for new code

## Benefits

### 1. Accuracy
- ✅ Browser activity only counted when browser window active
- ✅ Editor activity only counted when editor window active
- ✅ No double-counting
- ✅ Consistent with ActivityWatch web UI

### 2. Simplicity
- ✅ One tool instead of three
- ✅ Less confusion for users
- ✅ Easier to understand results

### 3. Rich Context
- ✅ See what you browsed while using Chrome
- ✅ See what you coded while using VS Code
- ✅ All in one unified view

### 4. Performance
- ✅ Server-side filtering (efficient)
- ✅ Single query for all data
- ✅ Reduced data transfer

## Testing

To test the implementation:

1. **Check capabilities:**
   ```
   aw_get_capabilities
   ```

2. **Get unified activity:**
   ```json
   {
     "tool": "aw_get_activity",
     "params": {
       "time_period": "today",
       "top_n": 5
     }
   }
   ```

3. **Verify enrichment:**
   - Check that browser data only appears for browser apps
   - Check that editor data only appears for editor apps
   - Verify total time matches window activity

## Configuration

### Customizing App Names

The browser and editor app names are configurable in `config/app-names.json`. This allows you to:

- Add support for new browsers/editors
- Add platform-specific app name variants
- Customize bucket detection patterns

See `config/README.md` for detailed instructions on customizing app names.

**Common customizations:**
- Adding Linux-specific app names (e.g., `jetbrains-webstorm`)
- Adding Windows .exe variants
- Adding macOS application names

**Example**: Adding a custom browser to `config/app-names.json`:
```json
{
  "browsers": {
    "mycustombrowser": ["MyCustomBrowser", "mycustombrowser.exe"]
  },
  "bucketDetection": {
    "browsers": {
      "mycustombrowser": ["mycustombrowser"]
    }
  }
}
```

## Future Enhancements

Potential improvements:

1. **Deprecate old tools** - Remove `aw_get_window_activity`, `aw_get_web_activity`, `aw_get_editor_activity`
2. **Add filtering** - Filter by category, app type, etc.
3. **Add aggregation** - Daily/weekly/monthly summaries
4. **Add insights** - Automatic pattern detection
5. **Environment-based config** - Allow users to override config via environment variables or user config file

## References

- [ActivityWatch Canonical Events](https://github.com/ActivityWatch/aw-client/blob/master/aw_client/queries.py)
- [Design Document](./CANONICAL_EVENTS_DESIGN.md)
- [Implementation Details](../architecture/implementation.md)
- [AFK Filtering](./AFK_FILTERING.md)
