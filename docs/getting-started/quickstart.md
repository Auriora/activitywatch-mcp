# Quick Start Guide

Last updated: October 11, 2025

Get up and running with the ActivityWatch MCP Server in 5 minutes.

## Prerequisites

✅ [ActivityWatch](https://activitywatch.net/) installed and running  
✅ Node.js 18 or higher installed  
✅ Claude Desktop (or another MCP client)

## Step 1: Install & Build

```bash
# Clone the repository
git clone <repository-url>
cd activitywatcher-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Step 2: Configure Claude Desktop

### Find your config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Add the server:

```json
{
  "mcpServers": {
    "activitywatch": {
      "command": "node",
      "args": [
        "/absolute/path/to/activitywatcher-mcp/dist/index.js"
      ]
    }
  }
}
```

**Important**: Replace `/absolute/path/to/activitywatcher-mcp` with the actual path!

### Get the absolute path:

```bash
# In the activitywatcher-mcp directory:
pwd
# Copy the output and use it in the config
```

## Step 3: Restart Claude Desktop

Completely quit and restart Claude Desktop for the changes to take effect.

## Step 4: Verify Installation

In Claude Desktop, try asking:

```
"What ActivityWatch data do I have available?"
```

Claude should call the `aw_get_capabilities` tool and show you:
- Available data sources (buckets)
- Date ranges of collected data
- Suggested tools you can use

## Step 5: Try Some Queries

### Basic Queries

```
"How much time did I spend on VS Code today?"
"What were my top 5 websites yesterday?"
"Summarize my activity for today"
```

### Time-Based Queries

```
"Show me my app usage for this week"
"What did I work on last Monday?"
"Compare my activity this week vs last week"
```

### Detailed Analysis

```
"When am I most active during the day?"
"What percentage of time do I spend on development tools?"
"Give me a breakdown of my browsing activity for yesterday"
```

## Common Issues

### "No window activity buckets found"

**Problem**: ActivityWatch window watcher is not running or has no data.

**Solution**:
1. Open ActivityWatch
2. Check that the window watcher is active (green icon)
3. Wait a few minutes for data to be collected
4. Try again

### "Failed to connect to ActivityWatch"

**Problem**: ActivityWatch server is not running.

**Solution**:
1. Start ActivityWatch
2. Verify it's running by visiting http://localhost:5600 in your browser
3. If using a different port, set the `AW_URL` environment variable in your config:

```json
{
  "mcpServers": {
    "activitywatch": {
      "command": "node",
      "args": ["/path/to/activitywatcher-mcp/dist/index.js"],
      "env": {
        "AW_URL": "http://localhost:5600"
      }
    }
  }
}
```

### Tools not appearing in Claude

**Problem**: Claude Desktop hasn't loaded the MCP server.

**Solution**:
1. Check the config file syntax (valid JSON)
2. Verify the absolute path is correct
3. Make sure `dist/index.js` exists (run `npm run build`)
4. Completely quit and restart Claude Desktop
5. Check Claude Desktop logs for errors

### Permission denied

**Problem**: The script is not executable.

**Solution**:
```bash
chmod +x dist/index.js
```

## Next Steps

### Learn More

- Start at the documentation landing page: ../index.md
- Explore the tools reference: ../reference/tools.md
- Read architecture details: ../architecture/implementation.md

### Customize

Edit the default parameters in `src/tools/schemas.ts` to match your preferences:
- Change default time periods
- Adjust top_n limits
- Modify excluded domains
- Change minimum duration filters

Then rebuild:
```bash
npm run build
```

### Develop

Watch mode for development:
```bash
npm run watch
```

This will automatically rebuild when you make changes to the source files.

## Example Workflow

Here's a typical workflow using the MCP server:

1. **Morning Check-in**
   ```
   "Summarize my activity for yesterday"
   ```

2. **Weekly Review**
   ```
   "What were my top 5 apps this week?"
   "How much time did I spend on different websites?"
   ```

3. **Productivity Analysis**
   ```
   "When am I most productive during the day?"
   "How much time do I spend in meetings vs coding?"
   ```

4. **Comparative Analysis**
   ```
   "Compare my activity this week to last week"
   "Am I spending more time on Slack than last month?"
   ```

## Tips for Best Results

1. **Always start with capabilities**: Ask "What data do I have?" first
2. **Use natural time periods**: "this week" instead of specific dates
3. **Be specific**: "VS Code" instead of "coding apps"
4. **Ask for summaries**: "Summarize" gives you the most useful overview
5. **Iterate**: Start broad, then drill down into specifics

## Support

If you encounter issues:

1. Review operational tips and troubleshooting: ../developer/logging-and-health.md
2. Verify ActivityWatch is running and collecting data
3. Check Claude Desktop logs for error messages
4. Open an issue on GitHub with:
   - Error message
   - Steps to reproduce
   - Your configuration (redact sensitive paths)

## What's Next?

Now that you're set up, you can:

- Explore different time periods and groupings
- Analyze your productivity patterns
- Track time spent on specific projects
- Identify time-wasting activities
- Optimize your daily schedule

Happy tracking! 🎉
