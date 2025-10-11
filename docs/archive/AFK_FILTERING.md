# AFK Filtering Implementation

## Overview

The ActivityWatch MCP server now uses **AFK (Away From Keyboard) filtering** for all activity data. This ensures that only time when the user is actively working is counted in activity reports.

## What Changed

### Before
- Services fetched raw events from buckets using `/api/0/buckets/{bucket_id}/events`
- Events included both active and AFK periods
- Activity metrics were inflated by time when user was away

### After
- Services use **QueryService** which leverages ActivityWatch's query API
- Queries automatically filter events to only include "not-afk" periods
- Activity metrics accurately reflect only active working time
- Consistent with ActivityWatch web UI behavior

## How It Works

### 1. QueryService

A new `QueryService` class handles all AFK-filtered data retrieval:

```typescript
// src/services/query.ts
export class QueryService {
  async getWindowEventsFiltered(startTime: Date, endTime: Date): Promise<QueryResult>
  async getBrowserEventsFiltered(startTime: Date, endTime: Date): Promise<QueryResult>
  async getEditorEventsFiltered(startTime: Date, endTime: Date): Promise<QueryResult>
}
```

### 2. Query Structure

The service builds queries using ActivityWatch's query language:

```javascript
// Get window events
events = query_bucket("aw-watcher-window_hostname");

// Get AFK events
afk_events = query_bucket("aw-watcher-afk_hostname");

// Filter to only "not-afk" periods
not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);

// Intersect window events with not-afk periods
events = filter_period_intersect(events, not_afk);

// Return filtered events
RETURN = events;
```

### 3. Service Integration

All activity services now use QueryService:

- **WindowActivityService**: Uses `queryService.getWindowEventsFiltered()`
- **WebActivityService**: Uses `queryService.getBrowserEventsFiltered()`
- **EditorActivityService**: Uses `queryService.getEditorEventsFiltered()`

### 4. Multi-Bucket Support

QueryService handles multiple buckets (e.g., multiple devices):

```typescript
// Combine events from all window and editor buckets
for (const bucket of allBuckets) {
  const query = this.buildWindowQuery(bucket.id, afkBucketId, hasAfk);
  const result = await this.executeQuery(startTime, endTime, query);
  allEvents.push(...result.events);
}
```

## Benefits

### 1. Accurate Metrics
- Only counts time when user is actively working
- No inflation from lunch breaks, meetings, or other AFK time

### 2. Consistent with Web UI
- Uses the same filtering logic as ActivityWatch's web interface
- Results match what users see in the dashboard

### 3. Server-Side Filtering
- Efficient: filtering happens on the server
- Reduces data transfer
- Faster query execution

### 4. Graceful Degradation
- If AFK tracking is unavailable, returns all events
- No errors or failures
- Logs warning for transparency

## Example Comparison

### Before (Raw Events)
```
Total time: 8 hours
- VS Code: 4 hours
- Chrome: 3 hours
- Slack: 1 hour
```

### After (AFK-Filtered)
```
Total active time: 5.5 hours
- VS Code: 3 hours (only active coding)
- Chrome: 2 hours (only active browsing)
- Slack: 0.5 hours (only active messaging)
```

## Tool Descriptions Updated

All tool descriptions now clearly indicate AFK filtering:

### aw_get_window_activity
```
CAPABILITIES:
- **AFK FILTERING**: Automatically filters events to only include active periods
...

LIMITATIONS:
- **Only counts time when user is actively working (AFK periods are excluded)**
...

RETURNS:
- total_time_seconds: Total active time in the period (AFK-filtered)
```

### aw_get_web_activity
```
CAPABILITIES:
- **AFK FILTERING**: Automatically filters events to only include active periods
...

LIMITATIONS:
- **Only counts time when user is actively browsing (AFK periods are excluded)**
...

RETURNS:
- total_time_seconds: Total browsing time in the period (AFK-filtered)
```

### aw_get_editor_activity
```
CAPABILITIES:
- **AFK FILTERING**: Automatically filters events to only include active periods
...

LIMITATIONS:
- **Only counts time when user is actively coding (AFK periods are excluded)**
...

RETURNS:
- total_time_seconds: Total editing time in the period (AFK-filtered)
```

## Implementation Details

### Files Changed

1. **New File**: `src/services/query.ts`
   - QueryService class
   - Query building methods
   - Query execution logic

2. **Modified**: `src/services/window-activity.ts`
   - Uses QueryService instead of direct API calls
   - Removed client and capabilities dependencies

3. **Modified**: `src/services/web-activity.ts`
   - Uses QueryService instead of direct API calls
   - Removed client and capabilities dependencies

4. **Modified**: `src/services/editor-activity.ts`
   - Uses QueryService instead of direct API calls
   - Removed client and capabilities dependencies

5. **Modified**: `src/index.ts`
   - Added QueryService initialization
   - Updated service constructors

6. **Modified**: `docs/IMPLEMENTATION.md`
   - Added AFK filtering section
   - Updated tool implementation descriptions

7. **Modified**: `docs/ACTIVITYWATCH_INTEGRATION.md`
   - Expanded AFK tracking section
   - Added query API details

### Testing

Build successful:
```bash
npm run build
# ✓ No TypeScript errors
# ✓ All services compile correctly
```

## Migration Notes

### For Users
- **No action required**: AFK filtering is automatic
- **More accurate metrics**: Activity reports now show only active time
- **Consistent results**: Matches ActivityWatch web UI

### For Developers
- **QueryService**: New service for AFK-filtered queries
- **Service constructors**: Updated to use QueryService
- **No breaking changes**: Tool interfaces remain the same

## Future Enhancements

Potential improvements:

1. **Configurable AFK threshold**: Allow users to adjust AFK sensitivity
2. **AFK pattern analysis**: Identify work patterns and breaks
3. **Multi-device AFK merging**: Handle AFK across multiple devices
4. **Custom AFK rules**: Support custom AFK detection logic

## References

- [ActivityWatch Query API](https://docs.activitywatch.net/en/latest/examples/working-with-data.html)
- [Query Language Reference](https://docs.activitywatch.net/en/latest/api/python.html#aw-transform)
- [AFK Detection](https://docs.activitywatch.net/en/latest/watchers.html#aw-watcher-afk)

