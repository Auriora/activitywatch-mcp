# Query Tool Implementation Summary (Archived)

Archived on: October 11, 2025

Note: This document is archived for historical context. For up-to-date usage and parameters of the aw_query_events tool, see the canonical reference:

- ../reference/query-tool.md

---

# Query Tool Implementation Summary

**Date:** October 11, 2025  
**Feature:** Custom Query Builder Tool (`aw_query_events`)

## Overview

Added a new `aw_query_events` tool that provides flexible query building capabilities for retrieving ActivityWatch events with advanced filtering and aggregation options. This tool bridges the gap between the simple `aw_get_raw_events` tool and the high-level analysis tools.

## What Was Added

### 1. New Schema (`src/tools/schemas.ts`)

Added `QueryEventsSchema` with comprehensive parameters:

- **Query Types**: window, browser, editor, afk, custom
- **Filtering Options**: filter_afk, filter_apps, exclude_apps, filter_domains, filter_titles
- **Aggregation Options**: merge_events, min_duration_seconds
- **Custom Query Support**: custom_query, bucket_ids
- **Output Options**: limit, response_format

### 2. Query Builder Service (`src/services/query-builder.ts`)

New service that:

- Builds queries based on query type and parameters
- Automatically discovers and queries relevant buckets
- Applies AFK filtering when requested
- Supports app, domain, and title filtering
- Merges events when requested
- Executes queries and returns structured results
- Supports custom ActivityWatch query language

### 3. Formatters (`src/utils/formatters.ts`)

Added two new formatters:

- `formatQueryResultsConcise()` - Summary with first 10 events
- `formatQueryResultsDetailed()` - Full event list with all fields

### 4. Tool Integration (`src/index.ts`)

- Imported `QueryBuilderService` and schemas
- Initialized `queryBuilderService`
- Added tool definition with comprehensive documentation
- Implemented tool handler with all response formats

### 5. Documentation (`docs/reference/query-tool.md`)

Comprehensive documentation including:

- When to use the tool
- Query types and examples
- Parameter reference
- Use cases and examples
- ActivityWatch query language reference
- Limitations and best practices

## Key Features

### Flexible Query Types

1. **Window Queries** - Filter application/window events
2. **Browser Queries** - Filter web browsing with domain filtering
3. **Editor Queries** - Filter code editor events
4. **AFK Queries** - Query away-from-keyboard events
5. **Custom Queries** - Full control with ActivityWatch query language

### Advanced Filtering

- **AFK Filtering**: Automatically filter out inactive periods
- **App Filtering**: Include or exclude specific applications
- **Domain Filtering**: Filter browser events by domain
- **Title Filtering**: Filter by window/page title patterns (regex)
- **Duration Filtering**: Filter out short events (noise reduction)

### Event Aggregation

- **Event Merging**: Combine consecutive similar events
- **Duration Thresholds**: Filter events by minimum duration
- **Multi-bucket Support**: Automatically queries relevant buckets

### Custom Query Support

- Full access to ActivityWatch query language
- Support for complex filtering logic
- Manual bucket selection
- Advanced users can build any query

## Use Cases

### 1. GitHub Activity Analysis
```json
{
  "query_type": "browser",
  "filter_domains": ["github.com"],
  "merge_events": true
}
```

### 2. Focused Coding Time
```json
{
  "query_type": "window",
  "filter_apps": ["Code", "Visual Studio Code"],
  "min_duration_seconds": 30
}
```

### 3. Meeting Time Analysis
```json
{
  "query_type": "window",
  "filter_apps": ["Zoom", "Microsoft Teams", "Google Meet"]
}
```

### 4. Documentation Reading
```json
{
  "query_type": "browser",
  "filter_domains": ["docs.python.org", "developer.mozilla.org"]
}
```

### 5. Email Activity
```json
{
  "query_type": "window",
  "filter_titles": ["Gmail", "Outlook", "Mail"]
}
```

## Response Format

The tool returns:

```jsonc
{
  "events": [...],
  "total_duration_seconds": 3600,
  "query_used": ["events = query_bucket(...);", "RETURN = events;"],
  "buckets_queried": ["aw-watcher-window_my-laptop"]
}
```

### Three Response Formats

1. **Concise**: Summary with first 10 events
2. **Detailed**: Full event list with key fields
3. **Raw**: Complete unprocessed JSON

## Technical Implementation

### Query Building Process

1. Parse and validate parameters
2. Discover relevant buckets based on query type
3. Build ActivityWatch query language statements
4. Apply filtering (AFK, apps, domains, titles)
5. Apply aggregation (merge events, duration filtering)
6. Execute query via ActivityWatch API
7. Post-process results (limit, duration filtering)
8. Format and return results

### Query Language Examples

**Window Query with AFK Filtering:**
```javascript
events = query_bucket("aw-watcher-window_hostname");
afk_events = query_bucket("aw-watcher-afk_hostname");
not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);
events = filter_period_intersect(events, not_afk);
events = filter_keyvals(events, "app", ["Chrome", "Firefox"]);
RETURN = events;
```

**Browser Query with Domain Filtering:**
```javascript
events = query_bucket("aw-watcher-web-chrome_hostname");
afk_events = query_bucket("aw-watcher-afk_hostname");
not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);
events = filter_period_intersect(events, not_afk);
events = filter_keyvals(events, "url", [".*github.com.*"]);
events = merge_events_by_keys(events, ["url"]);
RETURN = events;
```

## Benefits

### For Users

- **Flexibility**: Build custom queries without writing query language
- **Simplicity**: Easier than raw events, more flexible than high-level tools
- **Power**: Access to advanced filtering and aggregation
- **Transparency**: See the actual query used for debugging

### For Agents

- **Precise Filtering**: Get exactly the events needed
- **Efficient Queries**: Filter at query time, not post-processing
- **Debugging**: Query language visible in response
- **Extensibility**: Custom queries for advanced use cases

## Comparison with Other Tools

| Feature | aw_get_raw_events | aw_query_events | aw_get_activity |
|---------|-------------------|-----------------|-----------------|
| Filtering | None | Advanced | Basic |
| Aggregation | None | Optional | Automatic |
| AFK Filtering | Manual | Automatic | Automatic |
| Custom Queries | No | Yes | No |
| Ease of Use | Low | Medium | High |
| Flexibility | Low | High | Medium |
| Output | Raw events | Filtered events | Aggregated stats |

## Future Enhancements

Potential improvements:

1. **Query Templates**: Pre-built queries for common use cases
2. **Query Validation**: Validate custom queries before execution
3. **Query Optimization**: Suggest more efficient query patterns
4. **Result Caching**: Cache query results for repeated queries
5. **Query History**: Track and reuse previous queries
6. **Visual Query Builder**: GUI for building queries (web UI)

## Files Modified

1. `src/tools/schemas.ts` - Added QueryEventsSchema
2. `src/services/query-builder.ts` - New service (300 lines)
3. `src/utils/formatters.ts` - Added formatters
4. `src/index.ts` - Added tool definition and handler
5. `docs/reference/query-tool.md` - New documentation

## Testing Recommendations

1. Test each query type (window, browser, editor, afk, custom)
2. Test filtering options (apps, domains, titles)
3. Test aggregation (merge events, duration filtering)
4. Test AFK filtering on/off
5. Test response formats (concise, detailed, raw)
6. Test error handling (invalid buckets, invalid queries)
7. Test with multiple buckets
8. Test custom queries with ActivityWatch query language

## Conclusion

The `aw_query_events` tool provides a powerful and flexible way to query ActivityWatch data with advanced filtering and aggregation options. It fills the gap between simple raw event retrieval and high-level analysis tools, giving users and agents precise control over event queries while maintaining ease of use.
