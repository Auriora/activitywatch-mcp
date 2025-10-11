# Changelog

All notable changes to the ActivityWatch MCP Server project.

## [Unreleased]

### Added

#### Period Summary Feature
- **New Tool: `aw_get_period_summary`**
  - Flexible time period analysis beyond single days
  - Supports 6 period types: daily, weekly, monthly, last_24_hours, last_7_days, last_30_days
  - Multiple detail levels: hourly, daily, weekly, or none
  - Auto-selected detail levels based on period type
  - Timezone-aware period boundaries
  - Comprehensive insights including averages and trends

- **New Service: `PeriodSummaryService`** (`src/services/period-summary.ts`)
  - Orchestrates multi-day summaries
  - Generates period-appropriate breakdowns
  - Replaces the legacy daily summary implementation
  - Calculates period boundaries for all period types

- **Enhanced Time Utilities** (`src/utils/time.ts`)
  - `getStartOfWeek()` / `getEndOfWeek()` - Week boundary calculation
  - `getStartOfMonth()` / `getEndOfMonth()` - Month boundary calculation
  - `getStartOfWeekInTimezone()` / `getEndOfWeekInTimezone()` - Timezone-aware week boundaries
  - `getStartOfMonthInTimezone()` / `getEndOfMonthInTimezone()` - Timezone-aware month boundaries
  - `getDaysBetween()` - Generate array of dates between two dates
  - `getWeeksBetween()` - Generate array of week ranges

- **New Types** (`src/types.ts`)
  - `PeriodType` - Period type enumeration
  - `DetailLevel` - Detail level enumeration
  - `DailyActivity` - Daily breakdown structure
  - `WeeklyActivity` - Weekly breakdown structure
  - `PeriodSummary` - Complete period summary structure
  - `PeriodSummaryParams` - Tool parameters

- **Period Summary Formatter** (`src/utils/formatters.ts`)
  - `formatPeriodSummaryConcise()` - Human-readable period summary output
  - Visual bar charts for breakdowns
  - Period-specific formatting

- **Documentation**
  - Period summary examples (`docs/examples/period-summary-examples.md`)
  - Updated README with tool description and examples
  - Comprehensive test coverage for new time utilities

### Changed

- **Capabilities Service**
  - Now suggests `aw_get_period_summary` when tracking data is available
  - Updated tool roster (period summary replaces the legacy daily summary)

- **Tool Definitions**
  - Added comprehensive `aw_get_period_summary` tool definition
  - Detailed parameter descriptions and use cases

### Removed

- **Removed Tool: `aw_get_daily_summary`**
  - Functionality superseded by `aw_get_period_summary`
  - Eliminated `DailySummaryService` and related schemas/types
  - Consolidated formatting via period summary output helpers

## [1.1.0] - 2025-01-14

### Added

#### Comprehensive Logging System
- **New Logger Utility** (`src/utils/logger.ts`)
  - Configurable log levels: DEBUG, INFO, WARN, ERROR
  - Structured logging with JSON formatting
  - Environment variable control via `LOG_LEVEL`
  - Stderr output (doesn't interfere with MCP stdio)
  
- **Logging Throughout Codebase**
  - Client layer: API request/response logging
  - Service layer: Operation tracking, event counts, bucket discovery
  - Tool handlers: Tool calls, parameters, results
  - Error tracking with full context

#### Health Checks and Diagnostics
- **Health Check System** (`src/utils/health.ts`)
  - Automatic startup health check
  - Server reachability verification
  - Bucket availability detection
  - Capability detection (window/browser/AFK tracking)
  - Detailed warnings for missing features
  - Graceful degradation (server starts even if health check fails)

- **Startup Diagnostics**
  - Logs ActivityWatch URL
  - Logs Node.js version and platform
  - Logs configuration (log level, etc.)

#### Code Quality Improvements
- **Common Formatters** (`src/utils/formatters.ts`)
  - Extracted duplicate formatting logic
  - Centralized formatting functions
  - Consistent output across all tools
  - Reduced code duplication (~60 lines)

### Changed

#### Service Layer Refactoring
- **WindowActivityService**
  - Uses centralized formatter
  - Added comprehensive logging
  - Better error context

- **WebActivityService**
  - Uses centralized formatter
  - Added comprehensive logging
  - Better error context

- **DailySummaryService**
  - Uses centralized formatter
  - Added comprehensive logging
  - Better error context

#### Client Layer Enhancement
- **ActivityWatchClient**
  - Added request/response logging
  - Better error logging with context
  - Debug visibility into API calls

#### Main Server
- **index.ts**
  - Startup health check integration
  - Tool call logging
  - Result logging with metrics
  - Enhanced error logging

### Documentation

#### New Documentation
- **IMPROVEMENTS.md**: Detailed explanation of all improvements
- **CHANGELOG.md**: This file

#### Updated Documentation
- **README.md**
  - Added logging and debugging section
  - Added configuration options section
  - Added health check information
  - Added links to all documentation

### Technical Details

#### New Files
1. `src/utils/logger.ts` - Logging utility (62 lines)
2. `src/utils/formatters.ts` - Common formatters (98 lines)
3. `src/utils/health.ts` - Health checks (165 lines)
4. `IMPROVEMENTS.md` - Improvement documentation (300 lines)
5. `CHANGELOG.md` - This changelog

#### Modified Files
1. `src/client/activitywatch.ts` - Added logging
2. `src/services/window-activity.ts` - Added logging, extracted formatting
3. `src/services/web-activity.ts` - Added logging, extracted formatting
4. `src/services/daily-summary.ts` - Added logging, extracted formatting
5. `src/index.ts` - Added health check, logging, extracted formatting
6. `README.md` - Added logging/debugging section, configuration options

### Benefits

#### For Developers
- ✅ Full visibility into server operations
- ✅ Easy debugging with configurable log levels
- ✅ Performance insights (event counts, timing)
- ✅ Better error context
- ✅ More maintainable code (DRY principle)

#### For Users
- ✅ Early detection of configuration issues
- ✅ Clear warnings about missing features
- ✅ Better error messages
- ✅ Troubleshooting information

#### For Operations
- ✅ Audit trail of all operations
- ✅ Health monitoring
- ✅ Startup diagnostics
- ✅ Graceful degradation

---

## [1.0.0] - 2025-01-14

### Initial Release

#### Core Features
- **5 MCP Tools**
  1. `aw_get_capabilities` - Discover available data sources
  2. `aw_get_window_activity` - Application/window activity analysis
  3. `aw_get_web_activity` - Browser/website activity analysis
  4. `aw_get_daily_summary` - Comprehensive daily overview
  5. `aw_get_raw_events` - Low-level event access

#### Smart Features
- Automatic bucket discovery
- Natural language time periods
- Pre-aggregated data
- Multi-device support
- Intelligent filtering
- Flexible output formats

#### Architecture
- Service layer pattern
- Type-safe TypeScript implementation
- Zod schema validation
- Error handling with custom AWError class
- MCP SDK integration

#### Documentation
- README.md with comprehensive usage guide
- QUICKSTART.md for quick setup
- IMPLEMENTATION.md with technical details
- MCP_BEST_PRACTICES.md for tool design
- PARAMETER_DESCRIPTIONS.md for parameter design
- Example configuration file

---

## Version History

- **1.1.0** (2025-01-14): Added logging, health checks, code quality improvements
- **1.0.0** (2025-01-14): Initial release with 5 core tools

---

## Upgrade Guide

### From 1.0.0 to 1.1.0

No breaking changes. Simply rebuild:

```bash
npm run build
```

#### Optional: Enable Logging

Add `LOG_LEVEL` to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "activitywatch": {
      "command": "node",
      "args": ["/path/to/activitywatcher-mcp/dist/index.js"],
      "env": {
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

#### What You'll Notice

1. **Startup**: Health check runs automatically (check logs)
2. **Logging**: Operations are logged (configurable verbosity)
3. **Errors**: Better error messages with more context
4. **Warnings**: Helpful warnings for missing features

---

## Future Roadmap

### Phase 2 - Comparative Analysis (Planned)
- `aw_compare_periods` - Compare two time periods
- `aw_get_trends` - Identify trends over time
- `aw_get_focus_sessions` - Detect deep work sessions

### Phase 3 - Advanced Features (Planned)
- Category support
- Custom queries
- Export functionality
- Caching layer
- Performance optimizations

### Operational Enhancements (Planned)
- Metrics collection
- Log rotation
- Health check MCP tool
- Performance monitoring
- Cache logging

---

## Contributing

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for architecture details and [IMPROVEMENTS.md](IMPROVEMENTS.md) for code quality guidelines.

---

## License

MIT
