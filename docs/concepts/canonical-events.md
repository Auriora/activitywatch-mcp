# Canonical Events - Unified Activity Data

**Last updated:** October 11, 2025

## Overview

Canonical events is ActivityWatch's approach to unified activity tracking that properly combines window, browser, and editor data without double-counting or inaccuracies.

## The Problem with Separate Data Sources

Traditional approaches query each data source independently:
- Window events show when applications were active
- Browser events show web activity 
- Editor events show coding activity

**Issues:**
1. **Inaccurate attribution** - Browser/editor activity counted even when windows weren't active
2. **Double counting** - Same time period counted in multiple sources
3. **Missing context** - Can't see what you were browsing/coding while using each app

## How Canonical Events Work

The canonical events pattern uses **window events as the foundation** and enriches them with browser/editor data only when those windows were actually active.

### Data Flow

```
1. Window Events (Base Layer)
   ↓ Defines when each application was active
   ↓ Already filtered by AFK status
   
2. Browser Events (Enrichment Layer)
   ↓ Filtered to only when browser window was active
   ↓ Merged into window events
   
3. Editor Events (Enrichment Layer)  
   ↓ Filtered to only when editor window was active
   ↓ Merged into window events
   
4. Result: Enriched Activity Data
   ↓ Window events with browser/editor context when available
```

### Query Structure

The implementation uses ActivityWatch's query API with `filter_period_intersect` to ensure proper filtering:

```javascript
// 1. Get window events (AFK-filtered base)
window_events = query_bucket("aw-watcher-window_hostname");
afk_events = query_bucket("aw-watcher-afk_hostname");
not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);
window_events = filter_period_intersect(window_events, not_afk);

// 2. Filter to only Chrome windows
browser_windows = filter_keyvals(window_events, "app", ["Google Chrome"]);

// 3. Get browser events
browser_events = query_bucket("aw-watcher-web-chrome_hostname");

// 4. Filter browser events to only when Chrome was active
enriched_browser = filter_period_intersect(browser_events, browser_windows);
```

**Key insight:** `filter_period_intersect` ensures browser/editor events only count when those windows were actually active.

## AFK Filtering Integration

All canonical events are automatically filtered by AFK (Away From Keyboard) status:

- **Server-side filtering** - Uses ActivityWatch's query API for efficiency
- **Only active time counted** - Excludes lunch breaks, meetings, idle periods
- **Consistent with web UI** - Same filtering logic as ActivityWatch dashboard
- **Graceful degradation** - Falls back to unfiltered data if AFK tracking unavailable

### AFK Query Pattern

```javascript
// Get AFK periods marked as "not-afk" (user actively working)
afk_events = query_bucket("aw-watcher-afk_hostname");
not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);

// Apply to any activity data
activity_events = filter_period_intersect(activity_events, not_afk);
```

## Example: Before vs After

### Before (Separate Tools)
```
Window Activity: Chrome - 2.5 hours
Web Activity: github.com - 2.5 hours  ← Counted even when Chrome wasn't active!
```

**Problems:**
- Potential double-counting
- Browser time may be inflated
- No correlation between app and web activity

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
  "event_count": 45,
  "first_seen": "2025-10-11T09:00:00Z",
  "last_seen": "2025-10-11T11:30:00Z"
}
```

**Benefits:**
- ✅ **Accurate** - Browser data only when Chrome window was active
- ✅ **Rich context** - See what you browsed while using Chrome  
- ✅ **No double-counting** - Each second attributed once
- ✅ **AFK filtered** - Only counts active working time

## Enriched Data Structure

Canonical events return enriched activity data:

```typescript
interface CanonicalEvent {
  // Base fields (always present)
  app: string;                    // Application name
  title: string;                  // Window title  
  duration_seconds: number;
  duration_hours: number;
  percentage: number;
  
  // Browser enrichment (when browsing)
  browser?: {
    url: string;                  // Full URL
    domain: string;               // Extracted domain
    title: string;                // Page title
  };
  
  // Editor enrichment (when coding)
  editor?: {
    file: string;                 // File path
    project: string;              // Project name
    language: string;             // Programming language
    git?: {                       // Git metadata
      branch: string;
      commit: string;
      repository: string;
    };
  };
  
  // Metadata
  event_count: number;
  first_seen: string;             // ISO 8601 timestamp
  last_seen: string;              // ISO 8601 timestamp
}
```

## Implementation: UnifiedActivityService

The canonical events approach is implemented in `UnifiedActivityService`:

### Key Methods

1. **`getActivity()`** - Main entry point for unified activity analysis
2. **`enrichWindowEvents()`** - Merges browser/editor data into window events
3. **`extractBrowserData()`** - Extracts browser enrichment from events
4. **`extractEditorData()`** - Extracts editor enrichment from events

### Event Enrichment Process

```typescript
// 1. Get canonical events from QueryService
const canonical = await queryService.getCanonicalEvents(startTime, endTime);

// 2. Index browser/editor events by timestamp
const browserIndex = indexEventsByTime(canonical.browserEvents);
const editorIndex = indexEventsByTime(canonical.editorEvents);

// 3. Enrich each window event
for (const windowEvent of canonical.windowEvents) {
  const enriched = {
    ...windowEvent,
    browser: findMatchingBrowserEvent(windowEvent, browserIndex),
    editor: findMatchingEditorEvent(windowEvent, editorIndex)
  };
}

// 4. Group and aggregate
const grouped = groupEventsByApp(enrichedEvents);
```

## Tool Integration

The canonical events approach is accessed through the `aw_get_activity` tool:

### Recommended Usage

```json
{
  "time_period": "today",
  "include_browser_details": true,
  "include_editor_details": true,
  "response_format": "concise"
}
```

### Legacy Tool Compatibility

Existing tools (`aw_get_window_activity`, `aw_get_web_activity`, `aw_get_editor_activity`) remain available:

- **For focused analysis** - When you only want window or web data
- **Backward compatibility** - Existing integrations continue working
- **Performance** - Slightly faster for single-domain queries

**Recommendation:** Use `aw_get_activity` for general analysis; use specific tools for focused queries.

## Benefits Summary

### Accuracy
- ✅ **Window-based filtering** - Browser/editor activity only when windows active
- ✅ **AFK filtering** - Only counts active working time  
- ✅ **No double-counting** - Each time period attributed once
- ✅ **Consistent with ActivityWatch** - Same logic as web dashboard

### Rich Context  
- ✅ **See what you browsed** while using Chrome
- ✅ **See what you coded** while using VS Code
- ✅ **Unified timeline** - All activity in chronological context

### Performance
- ✅ **Server-side filtering** - Efficient query processing
- ✅ **Single API call** - Get all data in one request
- ✅ **Reduced data transfer** - Only relevant events returned

## Testing Canonical Events

### Verify Implementation

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
       "top_n": 5,
       "response_format": "detailed"
     }
   }
   ```

3. **Verify enrichment:**
   - Browser data only appears for browser applications
   - Editor data only appears for editor applications  
   - Total time matches window activity (no inflation)

### Compare with Legacy Tools

Compare `aw_get_activity` results with separate `aw_get_window_activity` and `aw_get_web_activity` calls to verify:
- No double-counting of time periods
- Browser enrichment matches filtered web activity
- Total active time is consistent

## References

- [ActivityWatch Canonical Events](https://github.com/ActivityWatch/aw-client/blob/master/aw_client/queries.py)
- [Tools Reference](../reference/tools.md#aw_get_activity) - `aw_get_activity` documentation
- [Implementation Details](../architecture/implementation.md) - Technical implementation
- [ActivityWatch Integration](../reference/activitywatch-integration.md) - Integration overview
