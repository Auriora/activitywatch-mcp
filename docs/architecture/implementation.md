# ActivityWatch MCP Server - Implementation Details

Last updated: October 11, 2025

## Overview

This MCP server provides LLM agents with tools to query and analyze ActivityWatch time tracking data. The implementation follows best practices for MCP tool design, minimizing LLM cognitive load by handling complex logic in code.

### Canonical Events Approach

The server uses ActivityWatch's canonical events pattern and AFK filtering across all tools. For the conceptual model and rationale, see: ../concepts/canonical-events.md

**Key Tool**: `aw_get_activity` — the recommended unified tool that returns enriched activity data with browser/editor details when available. Legacy tools (`aw_get_window_activity`, `aw_get_web_activity`, `aw_get_editor_activity`) remain supported.

## Architecture

### Layer Structure

```
┌─────────────────────────────────────┐
│         MCP Server (index.ts)       │  ← Tool definitions & request handlers
├─────────────────────────────────────┤
│      Services Layer                 │  ← Business logic & data processing
│  - CapabilitiesService              │
│  - QueryService (canonical queries) │  ← Uses ActivityWatch query API
│  - UnifiedActivityService           │  ← Canonical events implementation
│  - WindowActivityService            │  ← Legacy (still supported)
│  - WebActivityService               │  ← Legacy (still supported)
│  - EditorActivityService            │  ← Legacy (still supported)
│  - DailySummaryService              │
├─────────────────────────────────────┤
│      Client Layer                   │  ← ActivityWatch API client
│  - ActivityWatchClient              │
├─────────────────────────────────────┤
│      Utilities                      │  ← Helper functions
│  - Time utilities                   │
│  - Filters & normalization          │
└─────────────────────────────────────┘
```

## File Structure

```
src/
├── index.ts                    # MCP server entry point
├── types.ts                    # TypeScript type definitions (includes canonical event types)
├── client/
│   └── activitywatch.ts       # ActivityWatch API client
├── services/
│   ├── capabilities.ts        # Bucket discovery & capabilities detection
│   ├── query.ts               # Canonical query service (window-based filtering)
│   ├── unified-activity.ts    # Unified activity service (canonical events)
│   ├── window-activity.ts     # Window/app activity analysis (legacy)
│   ├── web-activity.ts        # Browser/web activity analysis (legacy)
│   ├── editor-activity.ts     # Editor/IDE activity analysis (legacy)
│   └── daily-summary.ts       # Daily summary generation
├── tools/
│   └── schemas.ts             # Zod schemas for tool parameters
└── utils/
    ├── time.ts                # Time period parsing & formatting
    └── filters.ts             # Data filtering & normalization
```

## Key Design Decisions

### 1. Code-First Approach

**Problem**: LLMs struggle with date math, bucket discovery, and data aggregation.

**Solution**: All complex logic is handled in code:
- Time period parsing (e.g., "this_week" → exact timestamps)
- Automatic bucket discovery (finds window/browser/afk buckets)
- Data aggregation and filtering
- Response formatting

### 2. Smart Defaults

**Problem**: Too many parameters increase LLM errors.

**Solution**: Sensible defaults for all optional parameters:
- `time_period`: "today"
- `top_n`: 10
- `response_format`: "concise"
- `exclude_system_apps`: true
- `min_duration_seconds`: 5

### 3. Natural Language Time Periods

**Problem**: LLMs make mistakes with date formatting and timezone handling.

**Solution**: Enum-based time periods:
- "today", "yesterday"
- "this_week", "last_week"
- "last_7_days", "last_30_days"
- "custom" (only when user specifies exact dates)

### 4. Response Format Options

**Problem**: Different queries need different levels of detail.

**Solution**: Three response formats:
- **concise**: Human-readable summary (default, saves tokens)
- **detailed**: Full structured data with all fields
- **raw**: Complete unprocessed data (for debugging)

### 5. Automatic Bucket Discovery

**Problem**: LLMs don't know bucket IDs and they vary by device.

**Solution**: Services automatically find relevant buckets:
- `findWindowBuckets()` - Finds all window tracking buckets
- `findBrowserBuckets()` - Finds all browser tracking buckets
- `findAfkBuckets()` - Finds all AFK detection buckets

### 6. Built-in Filtering

**Problem**: Raw data contains noise (system apps, localhost, short events).

**Solution**: Automatic filtering with override options:
- System apps excluded by default (Finder, Dock, etc.)
- Localhost/development URLs excluded
- Events < 5 seconds filtered out
- App name normalization (e.g., "Code" → "VS Code")

### 7. AFK Filtering

AFK filtering is implemented across all activity tools using ActivityWatch's query API. For details and examples, see ../concepts/canonical-events.md

## Tool Implementations

### 1. aw_get_capabilities

**Purpose**: Discovery tool - always called first

**Implementation**:
- Fetches all buckets from ActivityWatch
- Detects capabilities (window/browser/afk tracking)
- Calculates data ranges for each bucket
- Suggests applicable tools

**Key Code**: `src/services/capabilities.ts`

---

### 2. aw_get_window_activity

**Purpose**: Application/window activity analysis

**Implementation**:
1. Parse time period to exact timestamps
2. Use QueryService to get AFK-filtered events from window buckets
3. Filter by duration and system apps
4. Group by application name
5. Normalize app names
6. Calculate totals and percentages
7. Sort and limit to top N
8. Format response

**Key Code**: `src/services/window-activity.ts`, `src/services/query.ts`

---

### 3. aw_get_web_activity

**Purpose**: Browser/website activity analysis

**Implementation**:
1. Parse time period to exact timestamps
2. Use QueryService to get AFK-filtered events from browser buckets
3. Extract and normalize domains
4. Filter excluded domains (localhost, etc.)
5. Group by domain/url/title
6. Calculate totals and percentages
7. Sort and limit to top N
8. Format response

**Key Code**: `src/services/web-activity.ts`, `src/services/query.ts`

---

### 4. aw_get_editor_activity

**Purpose**: IDE/editor activity analysis

**Implementation**:
1. Parse time period to exact timestamps
2. Use QueryService to get AFK-filtered events from editor buckets
3. Filter by duration
4. Group by project/file/language/editor
5. Extract git metadata (if requested)
6. Calculate totals and percentages
7. Sort and limit to top N
8. Format response

**Key Code**: `src/services/editor-activity.ts`, `src/services/query.ts`

---

### 5. aw_get_daily_summary

**Purpose**: Comprehensive daily overview

**Implementation**:
1. Parse date (default to today)
2. Get AFK-filtered window activity for the day
3. Get AFK-filtered web activity for the day
4. Get AFK statistics from AFK tracking buckets
5. Generate hourly breakdown (optional)
6. Generate insights based on patterns
7. Format comprehensive summary

**Key Code**: `src/services/daily-summary.ts`

---

### 6. aw_get_raw_events

**Purpose**: Low-level access to raw events

**Implementation**:
1. Validate bucket_id exists
2. Fetch events with time range and limit
3. Format based on response_format
4. Return with pagination info

**Key Code**: `src/client/activitywatch.ts`

## Utility Functions

### Time Utilities (`src/utils/time.ts`)

- `getTimeRange()`: Convert time period enum to Date range
- `formatDateForAPI()`: Convert Date to ISO 8601 for API
- `formatDuration()`: Convert seconds to human-readable (e.g., "2h 30m")
- `secondsToHours()`: Convert seconds to hours (rounded)

### Filters (`src/utils/filters.ts`)

- `normalizeAppName()`: Handle app name variations
- `isSystemApp()`: Check if app should be excluded
- `extractDomain()`: Extract domain from URL
- `normalizeDomain()`: Remove www, lowercase
- `filterByDuration()`: Remove short events
- `calculatePercentage()`: Calculate percentage with rounding
- `sortByDuration()`: Sort items by duration descending

## Error Handling

### Custom Error Class

```typescript
class AWError extends Error {
  code: string;
  details?: unknown;
}
```

### Error Types

- `CONNECTION_ERROR`: Can't connect to ActivityWatch
- `API_ERROR`: ActivityWatch API returned error
- `NO_BUCKETS_FOUND`: No data sources available
- `INVALID_TIME_PERIOD`: Invalid time period parameter
- `INVALID_DATE_FORMAT`: Date string not parseable

### User-Friendly Messages

All errors include:
- Clear description of what went wrong
- Likely causes
- Suggested solutions
- Relevant context

Example:
```
No window activity buckets found. This usually means:
1. ActivityWatch is not running
2. The window watcher (aw-watcher-window) is not installed
3. No data has been collected yet

Suggestion: Use the "aw_get_capabilities" tool to see what data sources are available.
```

## Performance Optimizations

1. **Parallel Bucket Fetching**: Fetch events from multiple buckets concurrently
2. **Early Filtering**: Filter events before aggregation
3. **Lazy Data Loading**: Only fetch hourly breakdown if requested
4. **Response Format**: Default to concise format to save tokens
5. **Limit Results**: Default to top 10 items, configurable

## Testing Recommendations

### Unit Tests

- Time period parsing edge cases
- Domain extraction and normalization
- App name normalization
- Duration formatting
- Percentage calculations

### Integration Tests

- Bucket discovery with various configurations
- Window activity aggregation
- Web activity aggregation
- Daily summary generation
- Error handling

### End-to-End Tests

- Full workflow with real ActivityWatch instance
- Multi-device aggregation
- Time zone handling
- Large dataset performance

## Future Enhancements

### Comparative and Trends

- `aw_compare_periods`: Compare two time periods
- `aw_get_trends`: Identify trends over time
- `aw_get_focus_sessions`: Detect deep work sessions

### Advanced Features

- Custom queries using ActivityWatch query language (see ../reference/query-tool.md)
- Export functionality
- Caching for frequently accessed data

### Tool Landscape

- `aw_get_activity` is the recommended unified tool for general analysis
- Legacy tools (window/web/editor) remain supported and are not deprecated
- Categories are fully integrated; see ../concepts/categories.md and ../reference/tools.md

## Deployment

### Claude Desktop

1. Build the project: `npm run build`
2. Add to Claude Desktop config
3. Restart Claude Desktop
4. Verify tools appear in Claude

### Other MCP Clients

The server uses stdio transport and follows MCP specification, so it should work with any MCP-compatible client.

## Maintenance

### Updating Dependencies

```bash
npm update
npm audit fix
```

### Rebuilding

```bash
npm run build
```

### Watching for Changes

```bash
npm run watch
```

## Troubleshooting

### Build Errors

- Ensure TypeScript 5.5+ is installed
- Check `tsconfig.json` configuration
- Verify all imports use `.js` extensions (ES modules)

### Runtime Errors

- Verify ActivityWatch is running
- Check ActivityWatch URL (default: http://localhost:5600)
- Use `aw_get_capabilities` to diagnose data availability

### MCP Connection Issues

- Check Claude Desktop config syntax
- Verify absolute path to `dist/index.js`
- Check file permissions (should be executable)
- Review Claude Desktop logs

## Contributing

When adding new tools:

1. Define types in `src/types.ts`
2. Create Zod schema in `src/tools/schemas.ts`
3. Implement service logic in `src/services/`
4. Add tool definition to `src/index.ts`
5. Add request handler case
6. Update README.md
7. Add tests

Follow the existing patterns for consistency.
