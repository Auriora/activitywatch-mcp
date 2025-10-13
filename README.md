# ActivityWatch MCP Server

A Model Context Protocol (MCP) server that enables LLM agents to query and analyze [ActivityWatch](https://activitywatch.net/) time tracking data.

## Features

- **Smart Time Period Handling**: Natural language time periods like "today", "this_week", "last_7_days"
- **Automatic Bucket Discovery**: Finds relevant data sources automatically
- **Pre-Aggregated Data**: Returns human-readable summaries by default
- **Built-in Filtering**: Removes noise (system apps, localhost, short events)
- **Multi-Device Support**: Aggregates data across multiple devices
- **Comprehensive Analysis**: Window activity, web browsing, and period summaries
- **Category Management**: LLM-assisted category creation, updates, and organization
- **ActivityWatch Integration**: Full read/write access to ActivityWatch categories
- **Health Checks**: Automatic startup diagnostics and capability detection
- **Comprehensive Logging**: Configurable logging for debugging and monitoring
- **Production Ready**: Error handling, graceful degradation, and operational visibility

## Codebase Overview

### General Architecture

- The project is an MCP (Model Context Protocol) server that enables LLM agents to analyze ActivityWatch data. Both the stdio (`src/index.ts`) and HTTP/SSE (`src/http-server.ts`) entry points construct the same MCP server instance so transports share the same behavior.
- Runtime logic is layered: transports depend on service classes that implement business rules, which in turn use the dedicated ActivityWatch API client plus shared utilities.

### Important Components

- `src/client/ActivityWatchClient` (`ActivityWatchClient`) standardizes access to the ActivityWatch REST API (buckets, events, queries, settings) and centralizes error handling so it is easy to mock or extend.
- The `src/services/` directory contains the core business logic for capability detection, canonical queries, unified activity aggregation, category management, summaries, and calendar integration. These services are composed when creating the MCP server instance so every transport exposes identical tools.
- Tool schemas, formatting helpers, and utilities ensure LLM-friendly defaults, canonical filtering, and multiple presentation formats.

### Development Workflow, Commands, and Tests

- Day-to-day development typically uses the HTTP transport via `npm run start:http` for quick restarts. Supporting docs cover IDE configuration, environment variables, and troubleshooting connectivity.
- Testing uses Vitest with unit, integration, and end-to-end suites organized under `tests/`, with helper and fixture folders to avoid duplication. The test README explains what each layer covers and how to run them.

### Suggested Next Steps for Newcomers

1. Follow the quick start guide to build the project, configure Claude (or another MCP client), and try the discovery tools to confirm the environment works end to end.
2. Study the architecture and concept docs (canonical events, categories, tool reference) to understand how unified activity data is derived and why canonical filtering matters when extending or debugging tools.
3. Explore individual services and tests by pairing source files with their corresponding specs in `tests/` to clarify expected behavior before making changes or adding new tools.
4. Review operational docs (logging, health checks, HTTP server guide) to learn how to monitor the server, tweak log levels, and expose the MCP endpoint during development or deployment.

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

## Docker

Container artifacts live in `docker/`. Build and run the image directly:

```bash
docker build -f docker/Dockerfile -t activitywatcher-mcp .
docker run --rm -p 3000:3000 activitywatcher-mcp http
```

`docker-compose.yml` provides an HTTP/SSE stack wired to `http://localhost:3000/mcp`:

```bash
docker compose up
```

Customize defaults by copying `.env.example` to `.env` before running compose.

Publish a development image to GitHub Container Registry via:

```bash
./scripts/docker-publish.sh
```

Pass `--build-only` to skip the push or `--push-only` to reuse an existing image tag.

Switch to stdio mode by invoking the container with the `stdio` command:

```bash
docker run --rm -it activitywatcher-mcp stdio
```

See [docs/developer/docker.md](docs/developer/docker.md) for environment variables, profiles, and troubleshooting tips.

## License

This project is licensed under the terms of the [GNU General Public License v3.0](LICENSE).

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

See [docs/developer/http-server-development.md](docs/developer/http-server-development.md) for the full HTTP/SSE guide, including helper scripts, admin endpoints, and concurrency notes.

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

### 9. `aw_get_raw_events`

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

### 10. `aw_list_categories`

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

### 11. `aw_add_category`

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

### 12. `aw_update_category`

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

### 13. `aw_delete_category`

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

- Docs hub: [docs/index.md](docs/index.md) for full navigation.
- Plans: [docs/plans/](docs/plans/) for forward-looking initiatives.
- Updates: [docs/updates/](docs/updates/) for completed implementation logs.
- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Code of Conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Security policy: [SECURITY.md](SECURITY.md)

## Contributing

Contributions are welcome! Start with [CONTRIBUTING.md](CONTRIBUTING.md), and review [docs/developer/http-server-development.md](docs/developer/http-server-development.md) alongside the testing guide in [tests/README.md](tests/README.md) before submitting a PR.

## License

Distributed under the [GNU General Public License v3.0](LICENSE).
