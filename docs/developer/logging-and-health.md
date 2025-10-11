# Logging & Health Monitoring

**Last updated:** October 11, 2025

## Overview

The ActivityWatch MCP Server includes comprehensive logging and health monitoring features for operational visibility and troubleshooting.

## Logging System

### Logger Configuration

The server uses a structured logger with configurable levels:

```typescript
// src/utils/logger.ts
export const logger = {
  debug: (message: string, data?: unknown) => void,
  info: (message: string, data?: unknown) => void,
  warn: (message: string, data?: unknown) => void,
  error: (message: string, data?: unknown) => void
}
```

### Log Levels

Set via `LOG_LEVEL` environment variable:

| Level | Description | Use Case |
|-------|-------------|----------|
| `DEBUG` | All logs (very verbose) | Development, debugging |
| `INFO` | Informational and above (default) | Production monitoring |
| `WARN` | Warnings and errors only | Quiet production |
| `ERROR` | Errors only | Minimal logging |

### Usage Examples

**Development (verbose):**
```bash
LOG_LEVEL=DEBUG node dist/index.js
```

**Production (standard):**
```bash
LOG_LEVEL=INFO node dist/index.js
```

**Minimal (errors only):**
```bash
LOG_LEVEL=ERROR node dist/index.js
```

### Log Output

- **Destination:** stderr (doesn't interfere with MCP stdio)
- **Format:** `[timestamp] [level] message {structured_data}`
- **Timestamps:** ISO 8601 format with milliseconds

### Sample Log Output

```
[2025-10-11T10:30:00.123Z] [INFO] ActivityWatch MCP Server starting... {"awUrl":"http://localhost:5600","nodeVersion":"v20.0.0","platform":"linux","logLevel":"INFO"}
[2025-10-11T10:30:00.234Z] [INFO] Performing startup health check...
[2025-10-11T10:30:00.345Z] [INFO] ActivityWatch server reachable {"version":"0.12.0"}
[2025-10-11T10:30:00.456Z] [INFO] Found 3 buckets
[2025-10-11T10:30:00.567Z] [INFO] Health check complete {"healthy":true,"bucketsAvailable":3}
[2025-10-11T10:30:00.678Z] [INFO] ActivityWatch MCP server running on stdio
```

## What Gets Logged

### Startup Diagnostics
- Server configuration (URL, log level, platform)
- Health check results
- Available buckets and capabilities
- Category loading status

### Tool Execution
- Tool calls with parameters
- Data retrieval progress (bucket counts, event counts)  
- Response generation timing
- Success/failure status

### API Interactions
- HTTP requests to ActivityWatch API
- Response status codes and timing
- Connection errors and retries
- Query execution details

### Error Context
- Full error messages with stack traces
- Request parameters that caused errors
- Suggested solutions and troubleshooting steps
- System state when errors occurred

## Health Monitoring

### Startup Health Check

Runs automatically when server starts:

```typescript
// src/utils/health.ts
interface HealthCheckResult {
  healthy: boolean;
  serverReachable: boolean;
  serverVersion?: string;
  bucketsAvailable: number;
  hasWindowTracking: boolean;
  hasBrowserTracking: boolean;
  hasAfkTracking: boolean;
  errors: string[];
  warnings: string[];
}
```

### Health Check Process

1. **Server Connectivity** - Test ActivityWatch API endpoint
2. **Version Detection** - Get server version info
3. **Bucket Discovery** - Count available data sources
4. **Capability Detection** - Check tracking types available
5. **Warning Generation** - Flag missing features or data

### Health Check Outcomes

**Healthy System:**
```
[INFO] Health check complete {"healthy":true,"bucketsAvailable":3,"hasWindowTracking":true,"hasBrowserTracking":true,"hasAfkTracking":true}
[INFO] Health check passed
```

**System with Warnings:**
```
[WARN] No buckets available
[WARN] Window tracking not available  
[INFO] Health check complete {"healthy":true,"bucketsAvailable":0,"hasWindowTracking":false}
[WARN] Health check failed, but server will start anyway {"warnings":["No data buckets found","Window tracking not available"]}
```

**Server Unreachable:**
```
[ERROR] ActivityWatch server unreachable Error: fetch failed...
[INFO] Health check complete {"healthy":false,"serverReachable":false}
[WARN] Health check failed, but server will start anyway {"errors":["Cannot connect to ActivityWatch server. Is it running?"]}
```

### Graceful Degradation

The server **continues starting** even if health checks fail:
- Provides useful error messages to users
- Tools return appropriate error responses
- Suggests troubleshooting steps

## Operational Monitoring

### Performance Metrics

Logged automatically during operation:

```
[DEBUG] Fetching events from bucket: aw-watcher-window_hostname
[DEBUG] Retrieved 142 events from aw-watcher-window_hostname
[INFO] Total events collected: 142
[INFO] Window activity retrieved {"totalTime":18234,"appCount":10}
```

### Error Tracking

Comprehensive error context:

```
[ERROR] Tool error: aw_get_window_activity {"error":"No window activity buckets found","suggestion":"Check that ActivityWatch is running and window watcher is active","params":{"time_period":"today"}}
```

### Data Flow Visibility

Track data processing pipeline:

```
[DEBUG] Time range calculated {"start":"2025-10-11T00:00:00.000Z","end":"2025-10-11T10:30:15.345Z"}
[INFO] Found 1 window tracking buckets
[DEBUG] API request: GET /api/0/buckets/aw-watcher-window_hostname/events
[DEBUG] API response: GET /api/0/buckets/aw-watcher-window_hostname/events - 200
```

## Configuration

### Environment Variables

**`LOG_LEVEL`** - Controls logging verbosity
- Values: `DEBUG`, `INFO`, `WARN`, `ERROR`
- Default: `INFO`

**`AW_URL`** - ActivityWatch server URL
- Default: `http://localhost:5600`
- Used in health checks and API calls

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "activitywatch": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "LOG_LEVEL": "INFO",
        "AW_URL": "http://localhost:5600"
      }
    }
  }
}
```

## Troubleshooting with Logs

### Common Issues

**"No buckets found"**
1. Enable debug logging: `LOG_LEVEL=DEBUG`
2. Check server connectivity in logs
3. Look for bucket discovery results
4. Verify ActivityWatch is collecting data

**Tool execution failures:**
1. Check tool call parameters in logs
2. Look for API error responses
3. Verify time ranges are valid
4. Check bucket availability for requested data

**Performance issues:**
1. Monitor event counts in logs
2. Check API response times
3. Look for timeout or retry messages
4. Verify network connectivity

### Log Analysis

**Successful tool execution pattern:**
```
[INFO] Tool called: aw_get_activity
[DEBUG] Getting unified activity
[DEBUG] Time range calculated
[INFO] Found X buckets
[DEBUG] Retrieved Y events
[INFO] Activity retrieved
```

**Failed tool execution pattern:**
```
[INFO] Tool called: aw_get_activity  
[WARN] No window tracking buckets available
[ERROR] Tool error: aw_get_activity
```

## Log Management

### Log Rotation

For long-running servers, consider:
- External log rotation (logrotate)
- Log aggregation tools (ELK stack, Fluentd)
- Monitoring solutions (Prometheus, Grafana)

### Security Considerations

- Logs go to stderr, not files by default
- No sensitive data logged (tokens, passwords)
- User activity content not logged (only metadata)
- Error messages sanitized

## Development Usage

### Testing with Logs

```bash
# Run with debug logging
LOG_LEVEL=DEBUG npm start

# Test specific scenarios
echo '{"method":"call","params":{"name":"aw_get_capabilities"}}' | LOG_LEVEL=DEBUG node dist/index.js

# Monitor health checks
LOG_LEVEL=INFO node dist/index.js 2>&1 | grep "health"
```

### Adding Logging to Code

```typescript
import { logger } from '../utils/logger.js';

// Info level - general operations
logger.info('Processing request', { toolName, params });

// Debug level - detailed flow
logger.debug('Calculating time range', { start, end });

// Warn level - recoverable issues  
logger.warn('Bucket not found, skipping', { bucketId });

// Error level - failures
logger.error('API request failed', { error, endpoint });
```

## Health Check API

While there's no dedicated health endpoint, you can check server health through:

1. **Capabilities tool** - `aw_get_capabilities` returns health status
2. **Startup logs** - Check health check results on launch
3. **Error messages** - Tools provide health context in errors

## Performance Impact

### Logging Overhead

- **INFO level:** ~1-2% performance impact
- **DEBUG level:** ~5-10% performance impact (development only)
- **Structured data:** Minimal JSON serialization cost
- **stderr output:** Non-blocking I/O

### Memory Usage

- No log buffering (immediate output)
- No log file accumulation
- Minimal memory footprint

## Future Enhancements

Potential improvements:
- **Metrics collection** - Prometheus/StatsD integration
- **Distributed tracing** - Request correlation across services  
- **Log aggregation** - Structured JSON for external tools
- **Performance profiling** - Query execution timing
- **Health dashboard** - Web interface for status monitoring

## References

- [Implementation Details](../architecture/implementation.md) - Technical architecture
- [ActivityWatch Integration](../reference/activitywatch-integration.md) - API integration
- [Tools Reference](../reference/tools.md) - Tool error handling
