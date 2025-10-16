#!/usr/bin/env node

/**
 * ActivityWatch MCP Server (stdio entrypoint)
 *
 * Uses the shared server factory to create the MCP server and exposes it over stdio.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createMCPServer } from './server-factory.js';
import { logger } from './utils/logger.js';
import { logStartupDiagnostics } from './utils/health.js';

const AW_URL = process.env.AW_URL || 'http://localhost:5600';

async function main(): Promise<void> {
  try {
    logStartupDiagnostics(AW_URL);
    const server = await createMCPServer(AW_URL);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Ensure the Node process stays alive to accept stdio messages even when stdout/stderr are quiet.
    // StdioServerTransport attaches listeners but does not resume stdin, so we do it here.
    if (typeof process.stdin.resume === 'function') {
      process.stdin.resume();
    }
    const keepAlive = setInterval(() => {}, 2 ** 31 - 1);
    const shutdown = () => {
      clearInterval(keepAlive);
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    logger.info('ActivityWatch MCP server running on stdio');
    // Keep the process alive indefinitely; all interaction happens via stdio event handlers.
    await new Promise<never>(() => {});
  } catch (error) {
    logger.error('Failed to start ActivityWatch MCP stdio server', error);
    process.exitCode = 1;
  }
}

void main();
