# Development Setup - HTTP Server Mode

## Quick Start

```bash
# 1. Build the project
npm run build

# 2. Start the HTTP server
npm run start:http

# Or use the dev script
./scripts/dev-server.sh
```

## Configure Your IDE (Claude Desktop)

**File Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration:**
```json
{
  "mcpServers": {
    "activitywatch": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

**Restart Claude Desktop** after changing the config.

## Development Workflow

### Making Changes

1. **Edit your code** in your favorite editor
2. **Rebuild**: `npm run build`
3. **Restart server**: Stop (Ctrl+C) and run `npm run start:http` again
4. **Test in Claude** - No need to restart Claude!

### Quick Commands

```bash
# Build
npm run build

# Start HTTP server
npm run start:http

# Build and start (one command)
npm run dev:http

# Check server health
curl http://localhost:3000/health

# View logs with debug level
LOG_LEVEL=DEBUG npm run start:http
```

## Why HTTP Mode?

### Before (stdio mode)
```
Code change → Build → Restart entire IDE → Wait 10+ seconds → Test
```

### After (HTTP mode)
```
Code change → Build → Restart server (1 second) → Test
```

**Benefits:**
- ✅ 10x faster iteration
- ✅ Keep IDE state and windows
- ✅ Easy debugging with HTTP tools
- ✅ Health monitoring
- ✅ Multiple clients can connect

## Switching Between Modes

### Development (HTTP)

```json
{
  "mcpServers": {
    "activitywatch": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Start server: `npm run start:http`

### Production (stdio)

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

No server needed - runs automatically with Claude.

## Environment Variables

```bash
# Custom port
MCP_PORT=3001 npm run start:http

# Custom ActivityWatch URL
AW_URL=http://localhost:5600 npm run start:http

# Debug logging
LOG_LEVEL=DEBUG npm run start:http

# Combine multiple
MCP_PORT=3001 LOG_LEVEL=DEBUG npm run start:http
```

## Troubleshooting

### Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Solution:**
```bash
# Use a different port
MCP_PORT=3001 npm run start:http
```

### Claude Can't Connect

**Checklist:**
1. ✅ Server is running: `curl http://localhost:3000/health`
2. ✅ Config file has correct URL
3. ✅ Claude Desktop was restarted after config change
4. ✅ Port matches in config and server

### ActivityWatch Not Running

**Warning:** Server will start but tools will fail.

**Solution:**
1. Start ActivityWatch
2. Verify: `curl http://localhost:5600/api/0/info`
3. Restart MCP server

### Session Errors

**Error:** `Invalid or missing session ID`

**Cause:** Server was restarted

**Solution:** Restart Claude Desktop to create new session

## Testing Your Changes

### Manual Testing

```bash
# 1. Start server
npm run start:http

# 2. Test health endpoint
curl http://localhost:3000/health

# 3. Test in Claude Desktop
# Ask Claude: "What data do I have in ActivityWatch?"
```

### Automated Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Debugging

### Enable Debug Logs

```bash
LOG_LEVEL=DEBUG npm run start:http
```

### Monitor HTTP Traffic

Use any HTTP debugging tool:
- **curl** - Command line
- **Postman** - GUI client
- **Browser DevTools** - Network tab
- **HTTPie** - Modern curl alternative

### Example: Test Tool Call

```bash
# Initialize session
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    }
  }'

# Note the Mcp-Session-Id in the response headers
# Use it for subsequent requests
```

## File Structure

```
activitywatcher-mcp/
├── src/
│   ├── index.ts              # stdio transport (production)
│   ├── http-server.ts        # HTTP transport (development) ← NEW
│   ├── server-factory.ts     # Shared server logic ← NEW
│   └── tools/
│       └── definitions.ts    # Tool definitions ← NEW
├── dist/                     # Compiled JavaScript
├── HTTP-SERVER.md            # Quick reference ← NEW
├── DEVELOPMENT-SETUP.md      # This file ← NEW
└── docs/
    └── developer/
        └── http-server-development.md  # Full docs ← NEW
```

## Next Steps

1. **Read the full documentation**: [docs/developer/http-server-development.md](docs/developer/http-server-development.md)
2. **Try the HTTP server**: `npm run start:http`
3. **Configure Claude Desktop**: Update config file
4. **Start developing**: Make changes and iterate quickly!

## Getting Help

- **HTTP Server Issues**: See [HTTP-SERVER.md](HTTP-SERVER.md)
- **General Development**: See [docs/developer/](docs/developer/)
- **Testing**: See [tests/README.md](tests/README.md)
- **Architecture**: See [docs/architecture/](docs/architecture/)

## Summary

You now have two ways to run the MCP server:

1. **stdio** (production) - Runs as subprocess of Claude Desktop
2. **HTTP** (development) - Runs independently for fast iteration

Use HTTP mode during development for a much better experience!

