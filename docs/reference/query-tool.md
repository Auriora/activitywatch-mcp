# Query Events Tool - Custom Event Filtering

**Last updated:** October 11, 2025

## Overview

The `aw_query_events` tool provides a flexible query builder that allows you to construct custom queries with advanced filtering and aggregation options. This tool bridges the gap between the simple `aw_get_raw_events` tool and the high-level analysis tools.

## When to Use

### ✅ Use This Tool When:

- You need to filter events by specific applications, domains, or titles
- You want to combine multiple filtering criteria (e.g., "Chrome activity on github.com")
- You need custom time-based queries beyond standard tools
- You're doing advanced analysis requiring specific event filtering
- You want to build complex queries with AFK filtering and event merging
- Standard tools don't provide the exact filtering you need

### ❌ Don't Use This Tool When:

- For general activity overview → use `aw_get_activity`, `aw_get_window_activity`, or `aw_get_web_activity`
- For daily or multi-day summaries → use `aw_get_period_summary`
- When you need aggregated statistics → high-level tools are more efficient
- For simple queries → standard tools are easier to use

## Query Types

The tool supports five query types:

### 1. Window Queries (`query_type: "window"`)

Query application and window events.

**Example:**
```json
{
  "query_type": "window",
  "start_time": "2025-01-14T09:00:00Z",
  "end_time": "2025-01-14T17:00:00Z",
  "filter_apps": ["Chrome", "Firefox"],
  "exclude_apps": ["Finder", "Dock"],
  "min_duration_seconds": 5
}
```

### 2. Browser Queries (`query_type: "browser"`)

Query web browsing events with domain filtering.

**Example:**
```json
{
  "query_type": "browser",
  "start_time": "2025-01-14T09:00:00Z",
  "end_time": "2025-01-14T17:00:00Z",
  "filter_domains": ["github.com", "stackoverflow.com"],
  "merge_events": true
}
```

### 3. Editor Queries (`query_type: "editor"`)

Query code editor events.

**Example:**
```json
{
  "query_type": "editor",
  "start_time": "2025-01-14T09:00:00Z",
  "end_time": "2025-01-14T17:00:00Z",
  "merge_events": true,
  "min_duration_seconds": 10
}
```

### 4. AFK Queries (`query_type: "afk"`)

Query away-from-keyboard events.

**Example:**
```json
{
  "query_type": "afk",
  "start_time": "2025-01-14T09:00:00Z",
  "end_time": "2025-01-14T17:00:00Z"
}
```

### 5. Custom Queries (`query_type: "custom"`)

Build custom queries with full control using ActivityWatch query language.

**Example:**
```json
{
  "query_type": "custom",
  "start_time": "2025-01-14T09:00:00Z",
  "end_time": "2025-01-14T17:00:00Z",
  "custom_query": [
    "events = query_bucket(\"aw-watcher-window_my-laptop\");",
    "events = filter_keyvals(events, \"app\", [\"Chrome\"]);",
    "RETURN = events;"
  ],
  "bucket_ids": ["aw-watcher-window_my-laptop"]
}
```

## Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `query_type` | string | Type of query: "window", "browser", "editor", "afk", or "custom" |
| `start_time` | string | Start timestamp in ISO 8601 format |
| `end_time` | string | End timestamp in ISO 8601 format |

### Filtering Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `filter_afk` | boolean | `true` | Filter out AFK periods (only include active time) |
| `filter_apps` | string[] | - | Include only specific applications |
| `exclude_apps` | string[] | - | Exclude specific applications |
| `filter_domains` | string[] | - | Include only specific domains (browser queries) |
| `filter_titles` | string[] | - | Filter by window/page title patterns (regex) |

### Aggregation Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `merge_events` | boolean | `true` | Merge consecutive similar events |
| `min_duration_seconds` | number | `0` | Minimum event duration to include |

### Custom Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `custom_query` | string[] | Custom ActivityWatch query language statements |
| `bucket_ids` | string[] | Specific bucket IDs to query |

### Output Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | `1000` | Maximum number of events to return |
| `response_format` | string | `"detailed"` | Output format: "concise", "detailed", or "raw" |

## Response Format

The tool returns:

```json
{
  "events": [...],
  "total_duration_seconds": 3600,
  "query_used": ["events = query_bucket(...);", "RETURN = events;"],
  "buckets_queried": ["aw-watcher-window_my-laptop"]
}
```

### Response Formats

- **concise**: Summary with first 10 events
- **detailed**: Full event list with key fields
- **raw**: Complete unprocessed JSON

## Use Cases

### 1. GitHub Activity Analysis

Find all time spent on GitHub:

```json
{
  "query_type": "browser",
  "start_time": "2025-01-14T00:00:00Z",
  "end_time": "2025-01-14T23:59:59Z",
  "filter_domains": ["github.com"],
  "merge_events": true,
  "min_duration_seconds": 5
}
```

### 2. Focused Coding Time

Find all VS Code activity excluding system files:

```json
{
  "query_type": "window",
  "start_time": "2025-01-14T09:00:00Z",
  "end_time": "2025-01-14T17:00:00Z",
  "filter_apps": ["Code", "Visual Studio Code"],
  "filter_afk": true,
  "min_duration_seconds": 30
}
```

### 3. Meeting Time Analysis

Find all time in video conferencing apps:

```json
{
  "query_type": "window",
  "start_time": "2025-01-14T00:00:00Z",
  "end_time": "2025-01-14T23:59:59Z",
  "filter_apps": ["Zoom", "Microsoft Teams", "Google Meet"],
  "merge_events": true
}
```

### 4. Documentation Reading

Find all time on documentation sites:

```json
{
  "query_type": "browser",
  "start_time": "2025-01-14T00:00:00Z",
  "end_time": "2025-01-14T23:59:59Z",
  "filter_domains": ["docs.python.org", "developer.mozilla.org", "stackoverflow.com"],
  "min_duration_seconds": 10
}
```

### 5. Email Activity

Find all email-related activity:

```json
{
  "query_type": "window",
  "start_time": "2025-01-14T00:00:00Z",
  "end_time": "2025-01-14T23:59:59Z",
  "filter_titles": ["Gmail", "Outlook", "Mail"],
  "merge_events": true
}
```

## Advanced Features

### AFK Filtering

By default, the tool filters out AFK (away from keyboard) periods. This ensures you only see active time:

```json
{
  "filter_afk": true  // Default
}
```

To include all time regardless of AFK status:

```json
{
  "filter_afk": false
}
```

### Event Merging

Merge consecutive events with the same app/title for cleaner results:

```json
{
  "merge_events": true  // Default
}
```

### Duration Filtering

Filter out short events (noise reduction):

```json
{
  "min_duration_seconds": 5  // Filter events shorter than 5 seconds
}
```

## ActivityWatch Query Language

For custom queries, you can use the full ActivityWatch query language:

### Common Functions

- `query_bucket(bucket_id)` - Get events from a bucket
- `filter_keyvals(events, key, values)` - Filter events by key/value
- `exclude_keyvals(events, key, values)` - Exclude events by key/value
- `filter_period_intersect(events1, events2)` - Intersect event periods
- `merge_events_by_keys(events, keys)` - Merge events by keys

### Example Custom Query

```json
{
  "query_type": "custom",
  "custom_query": [
    "window_events = query_bucket(\"aw-watcher-window_my-laptop\");",
    "afk_events = query_bucket(\"aw-watcher-afk_my-laptop\");",
    "not_afk = filter_keyvals(afk_events, \"status\", [\"not-afk\"]);",
    "window_events = filter_period_intersect(window_events, not_afk);",
    "chrome_events = filter_keyvals(window_events, \"app\", [\"Chrome\"]);",
    "RETURN = chrome_events;"
  ],
  "bucket_ids": ["aw-watcher-window_my-laptop", "aw-watcher-afk_my-laptop"]
}
```

## Limitations

- Requires understanding of query parameters
- Custom queries require knowledge of ActivityWatch query language
- Time range must be specified in ISO 8601 format
- Results limited by `limit` parameter (default: 1000, max: 10000)
- No automatic aggregation or statistics (use high-level tools for that)

## See Also

- [aw_get_raw_events](./tools.md#aw_get_raw_events) - Simple raw event retrieval
- [aw_get_activity](./tools.md#aw_get_activity) - High-level unified activity analysis
- [aw_get_window_activity](./tools.md#aw_get_window_activity) - Application usage analysis
- [aw_get_web_activity](./tools.md#aw_get_web_activity) - Web browsing analysis
- [ActivityWatch Query Language](https://docs.activitywatch.net/en/latest/examples/working-with-data.html) - Official documentation
