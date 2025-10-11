# ActivityWatch MCP Server

A Model Context Protocol (MCP) server that enables LLM agents to query and analyze [ActivityWatch](https://activitywatch.net/) time tracking data.

## Features

- **Smart Time Period Handling**: Natural language time periods like "today", "this_week", "last_7_days"
- **Automatic Bucket Discovery**: Finds relevant data sources automatically
- **Pre-Aggregated Data**: Returns human-readable summaries by default
- **Built-in Filtering**: Removes noise (system apps, localhost, short events)
- **Multi-Device Support**: Aggregates data across multiple devices
- **Comprehensive Analysis**: Window activity, web browsing, and daily summaries
- **Category Management**: LLM-assisted category creation, updates, and organization
- **ActivityWatch Integration**: Full read/write access to ActivityWatch categories
- **Health Checks**: Automatic startup diagnostics and capability detection
- **Comprehensive Logging**: Configurable logging for debugging and monitoring
- **Production Ready**: Error handling, graceful degradation, and operational visibility

## Prerequisites

- [ActivityWatch](https://activitywatch.net/) installed and running
- Node.js 18+ 
- ActivityWatch server running on `http://localhost:5600` (default)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd activitywatcher-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## Testing

The project includes a comprehensive test suite using Vitest:

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run E2E tests only (requires ActivityWatch running)
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```

**Test Structure:**
- `tests/unit/` - Unit tests for utilities and individual functions
- `tests/integration/` - Integration tests for service interactions
- `tests/e2e/` - End-to-end tests for complete workflows (requires ActivityWatch)
- `tests/helpers/` - Test utilities and mock implementations
- `tests/fixtures/` - Test data and mock responses

See [tests/README.md](tests/README.md) for detailed testing documentation.

## Configuration

### Development Mode (HTTP Server)

For faster development without restarting your IDE:

```bash
npm run start:http
```

Then configure Claude Desktop to use HTTP transport:

```json
{
  "mcpServers": {
    "activitywatch": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

**Benefits:**
- ✅ Restart only the MCP server, not your IDE
- ✅ Fast development iteration
- ✅ Easy debugging with HTTP tools
- ✅ Health check endpoint at `http://localhost:3000/health`

See [HTTP-SERVER.md](HTTP-SERVER.md) for complete HTTP server documentation.

### Production Mode (stdio)

For production use with Claude Desktop:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "activitywatch": {
      "command": "node",
      "args": ["/absolute/path/to/activitywatcher-mcp/dist/index.js"]
    }
  }
}
```

### Configuration Options

You can customize the server behavior with environment variables:

```json
{
  "mcpServers": {
    "activitywatch": {
      "command": "node",
      "args": ["/absolute/path/to/activitywatcher-mcp/dist/index.js"],
      "env": {
        "AW_URL": "http://localhost:5600",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

**Environment Variables**:
- `AW_URL`: ActivityWatch server URL (default: `http://localhost:5600`)
- `LOG_LEVEL`: Logging verbosity - `DEBUG`, `INFO`, `WARN`, or `ERROR` (default: `INFO`)

## Available Tools

### 1. `aw_get_capabilities`

Discover what ActivityWatch data is available.

**Use this first** to understand what data sources exist and what analyses are possible.

**Returns:**
- Available buckets with descriptions
- Capabilities (window tracking, browser tracking, AFK detection)
- Suggested tools based on available data

**Example:**
```
User: "What ActivityWatch data do I have?"
LLM calls: aw_get_capabilities()
```

---

### 2. `aw_get_activity`

Recommended unified analysis combining window, browser, and editor data with AFK filtering and canonical events. Prevents double-counting and enriches app usage with browsing/editor details when available. Categories are always included when configured.

**Parameters (common):**
- `time_period`, `custom_start`, `custom_end`, `top_n`, `group_by` (application/title/category)
- `exclude_system_apps`, `min_duration_seconds`, `response_format` (concise/detailed)
- Browser/editor details shown in detailed format only

**Example:**
```
User: "What did I work on today?"
LLM calls: aw_get_activity({ time_period: "today" })

User: "Show me detailed activity grouped by category"
LLM calls: aw_get_activity({ time_period: "today", group_by: "category", response_format: "detailed" })
```

---

### 3. `aw_get_window_activity`

Get application/window activity for a time period.

**Parameters:**
- `time_period`: "today" | "yesterday" | "this_week" | "last_week" | "last_7_days" | "last_30_days" | "custom"
- `custom_start`: ISO 8601 or YYYY-MM-DD (required if time_period="custom")
- `custom_end`: ISO 8601 or YYYY-MM-DD (required if time_period="custom")
- `top_n`: Number of top apps to return (default: 10)
- `group_by`: "application" | "title" | "both" (default: "application")
- `response_format`: "concise" | "detailed" (default: "concise")
- `exclude_system_apps`: boolean (default: true)
- `min_duration_seconds`: Filter short events (default: 5)
- `include_categories`: boolean (default: false)

**Example:**
```
User: "How much time did I spend on VS Code this week?"
LLM calls: aw_get_window_activity({ time_period: "this_week" })
```

---

### 4. `aw_get_web_activity`

Get browser/website activity for a time period.

**Parameters:**
- `time_period`: "today" | "yesterday" | "this_week" | "last_week" | "last_7_days" | "last_30_days" | "custom"
- `custom_start`: ISO 8601 or YYYY-MM-DD (required if time_period="custom")
- `custom_end`: ISO 8601 or YYYY-MM-DD (required if time_period="custom")
- `top_n`: Number of top websites to return (default: 10)
- `group_by`: "domain" | "url" | "title" (default: "domain")
- `response_format`: "concise" | "detailed" (default: "concise")
- `exclude_domains`: Array of domains to exclude (default: ["localhost", "127.0.0.1"])
- `min_duration_seconds`: Filter short visits (default: 5)
- `include_categories`: boolean (default: false)

**Example:**
```
User: "What were my top 5 websites yesterday?"
LLM calls: aw_get_web_activity({ time_period: "yesterday", top_n: 5 })
```

---

### 5. `aw_get_editor_activity`

Analyze IDE/editor activity over a time period.

**Parameters:**
- `time_period`, `custom_start`, `custom_end`, `top_n`
- `group_by`: "project" | "file" | "language" | "editor"
- `include_git_info`, `include_categories`, `min_duration_seconds`, `response_format`

**Example:**
```
User: "What did I code today?"
LLM calls: aw_get_editor_activity({ time_period: "today", group_by: "project" })
```

---

### 6. `aw_get_daily_summary`

Get a comprehensive summary of activity for a specific day.

**Parameters:**
- `date`: YYYY-MM-DD format (default: today)
- `include_hourly_breakdown`: boolean (default: true)

**Returns:**
- Total active time and AFK time
- Top 5 applications with time and percentages
- Top 5 websites with time and percentages
- Hourly activity breakdown
- Auto-generated insights

**Example:**
```
User: "Summarize my activity for yesterday"
LLM calls: aw_get_daily_summary({ date: "2025-01-13" })
```

---

### 7. `aw_query_events`

Build and execute custom queries with flexible filtering.

**Use this when:**
- You need to filter events by specific apps, domains, or titles
- You want to combine multiple filtering criteria
- Standard tools don't provide the exact filtering needed

**Parameters:**
- `query_type`, `start_time`, `end_time`
- Filtering: `filter_afk`, `filter_apps`, `exclude_apps`, `filter_domains`, `filter_titles`
- Aggregation: `merge_events`, `min_duration_seconds`
- Custom: `custom_query`, `bucket_ids`
- Output: `limit`, `response_format`

**Examples:**
```
User: "Show me all my GitHub activity today"
LLM calls: aw_query_events({
  query_type: "browser",
  start_time: "2025-01-14T00:00:00Z",
  end_time: "2025-01-14T23:59:59Z",
  filter_domains: ["github.com"]
})
```

---

### 8. `aw_get_raw_events`

Retrieve raw events from a specific bucket.

**Use this only when:**
- You need exact event data with timestamps
- Other high-level tools cannot answer the query
- You're debugging or exporting data

**Parameters:**
- `bucket_id`: Bucket identifier (use aw_get_capabilities to discover)
- `start_time`: ISO 8601 format
- `end_time`: ISO 8601 format
- `limit`: Max events to return (default: 100, max: 10000)
- `response_format`: "concise" | "detailed" | "raw"

**Example:**
```
User: "Show me raw window events from 2pm to 3pm today"
LLM calls: aw_get_raw_events({
  bucket_id: "aw-watcher-window_hostname",
  start_time: "2025-01-14T14:00:00Z",
  end_time: "2025-01-14T15:00:00Z"
})
```

---

### 9. `aw_list_categories`

List all configured categories in ActivityWatch.

**Returns:**
- Array of categories with IDs, names, and regex patterns
- Total category count

**Example:**
```
User: "What categories do I have configured?"
LLM calls: aw_list_categories()
```

---

### 10. `aw_add_category`

Create a new category for activity classification.

**Parameters:**
- `name`: Array of strings for hierarchical name (e.g., ["Work", "Email"])
- `regex`: Regular expression pattern to match activities

**Example:**
```
User: "Create a category for my gaming activities"
LLM calls: aw_add_category({
  name: ["Entertainment", "Gaming"],
  regex: "steam|epic|gog|game"
})
```

---

### 11. `aw_update_category`

Update an existing category's name or regex pattern.

**Parameters:**
- `id`: Category ID to update
- `name`: (Optional) New hierarchical name
- `regex`: (Optional) New regex pattern

**Example:**
```
User: "Add Thunderbird to my email category"
LLM calls: aw_update_category({
  id: 1,
  regex: "gmail|outlook|mail|thunderbird"
})
```

---

### 12. `aw_delete_category`

Delete a category from ActivityWatch.

**Parameters:**
- `id`: Category ID to delete

**Example:**
```
User: "Remove the gaming category"
LLM calls: aw_delete_category({ id: 5 })
```

**⚠️ Warning**: This permanently removes the category from ActivityWatch.

---

## Architecture

The server is designed to minimize LLM cognitive load by handling complex logic in code:

- **Time Period Parsing**: Converts natural language periods to exact timestamps
- **Bucket Discovery**: Automatically finds relevant data sources
- **Data Aggregation**: Pre-processes and summarizes raw events
- **Filtering**: Removes noise (system apps, localhost, short events)
- **Normalization**: Handles app name variations and domain normalization
- **Smart Defaults**: Sensible parameter defaults for common use cases

## Development

```bash
# Watch mode (auto-rebuild on changes)
npm run watch

# Build
npm run build

# Run directly
npm start
```

## Troubleshooting

### "No window activity buckets found"

**Cause**: ActivityWatch window watcher is not running or no data has been collected.

**Solution**:
1. Ensure ActivityWatch is running
2. Check that `aw-watcher-window` is installed and active
3. Use `aw_get_capabilities` to see what data sources are available

### "Failed to connect to ActivityWatch"

**Cause**: ActivityWatch server is not running or is on a different URL.

**Solution**:
1. Start ActivityWatch
2. Verify it's running on `http://localhost:5600`
3. If using a different URL, set the `AW_URL` environment variable

### "Invalid date format"

**Cause**: Date string is not in the correct format.

**Solution**: Use YYYY-MM-DD format (e.g., "2025-01-14") or ISO 8601 format.

## Logging and Debugging

The server includes comprehensive logging for troubleshooting and monitoring.

### Viewing Logs

Logs are written to stderr and can be viewed in:
- **Claude Desktop**: Check the MCP server logs in Claude's developer console
- **Command Line**: Run the server directly to see logs in terminal

### Log Levels

Set the `LOG_LEVEL` environment variable to control verbosity:

- **`DEBUG`**: Very verbose - shows all API calls, event counts, time ranges
- **`INFO`** (default): Informational messages - tool calls, bucket counts, results
- **`WARN`**: Warnings only - missing features, failed buckets
- **`ERROR`**: Errors only - connection failures, API errors

### Example Debug Session

```json
{
  "mcpServers": {
    "activitywatch": {
      "command": "node",
      "args": ["/path/to/activitywatcher-mcp/dist/index.js"],
      "env": {
        "LOG_LEVEL": "DEBUG"
      }
    }
  }
}
```

### Health Check

The server performs an automatic health check on startup:
- Verifies ActivityWatch is reachable
- Checks server version
- Counts available buckets
- Detects tracking capabilities (window/browser/AFK)
- Logs warnings for missing features

Check the logs after starting to see the health check results.

## Documentation

- Documentation landing page: docs/index.md
- Quickstart: docs/getting-started/quickstart.md
- Implementation details: docs/architecture/implementation.md
- Developer best practices: docs/developer/best-practices.md
- Tools reference (API): docs/reference/tools.md

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
