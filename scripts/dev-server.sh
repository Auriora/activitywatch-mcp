#!/bin/bash

# Development server script with auto-rebuild
# Usage: ./scripts/dev-server.sh

set -e

echo "🚀 Starting ActivityWatch MCP Development Server"
echo ""

# Check if ActivityWatch is running
if ! curl -s http://localhost:5600/api/0/info > /dev/null 2>&1; then
    echo "⚠️  Warning: ActivityWatch doesn't appear to be running on http://localhost:5600"
    echo "   The server will start, but tools may fail until ActivityWatch is running."
    echo ""
fi

# Build the project
echo "📦 Building project..."
npm run build

# Start the HTTP server
echo ""
echo "✅ Build complete!"
echo ""
echo "🌐 Starting HTTP server on http://localhost:${MCP_PORT:-3000}"
echo "   Health check: http://localhost:${MCP_PORT:-3000}/health"
echo "   MCP endpoint: http://localhost:${MCP_PORT:-3000}/mcp"
echo ""
echo "💡 To restart after code changes:"
echo "   1. Press Ctrl+C to stop the server"
echo "   2. Run: npm run build && npm run start:http"
echo ""
echo "📝 Logs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run start:http

