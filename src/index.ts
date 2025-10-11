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
    logger.info('ActivityWatch MCP server running on stdio');
  } catch (error) {
    logger.error('Failed to start ActivityWatch MCP stdio server', error);
    process.exitCode = 1;
  }
}

void main();
