/**
 * End-to-End tests for MCP Server
 * 
 * These tests verify the complete MCP server functionality including:
 * - Server initialization
 * - Tool registration
 * - Tool execution
 * - JSON-RPC communication
 * 
 * Note: These tests require a running ActivityWatch server.
 * Set AW_URL environment variable to point to your ActivityWatch instance.
 * 
 * To skip these tests if ActivityWatch is not available:
 * - Use `npm run test:unit` or `npm run test:integration` instead
 * - Or set SKIP_E2E=true environment variable
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Skip E2E tests if explicitly disabled or ActivityWatch not available
const SKIP_E2E = process.env.SKIP_E2E === 'true';
const AW_URL = process.env.AW_URL || 'http://localhost:5600';

describe.skipIf(SKIP_E2E)('MCP Server E2E', () => {
  let server: ChildProcess;
  let serverReady = false;

  beforeAll(async () => {
    // Start the MCP server
    const serverPath = join(__dirname, '..', '..', 'dist', 'index.js');
    
    server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        AW_URL,
      },
    });

    // Wait for server to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 10000);

      server.stderr?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('ActivityWatch MCP Server started')) {
          serverReady = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      server.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 15000);

  afterAll(() => {
    if (server) {
      server.kill();
    }
  });

  describe('Server Initialization', () => {
    it('should start successfully', () => {
      expect(serverReady).toBe(true);
      expect(server.killed).toBe(false);
    });

    it('should respond to initialize request', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      });

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.capabilities).toBeDefined();
    });
  });

  describe('Tool Discovery', () => {
    it('should list available tools', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      });

      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);
      
      const toolNames = response.result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('aw_get_capabilities');
      expect(toolNames).toContain('aw_get_activity');
      expect(toolNames).toContain('aw_get_window_activity');
      expect(toolNames).toContain('aw_get_web_activity');
    });
  });

  describe('Capabilities Tool', () => {
    it('should get ActivityWatch capabilities', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'aw_get_capabilities',
          arguments: {},
        },
      });

      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      expect(Array.isArray(response.result.content)).toBe(true);
      
      const content = JSON.parse(response.result.content[0].text);
      expect(content.available_buckets).toBeDefined();
      expect(content.capabilities).toBeDefined();
    });
  });

  describe('Unified Activity Tool', () => {
    it('should get unified activity for today', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'aw_get_activity',
          arguments: {
            time_period: 'today',
            top_n: 5,
            response_format: 'concise',
            include_browser_details: true,
            include_editor_details: true,
          },
        },
      });

      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].type).toBe('text');
    }, 10000);

    it('should get detailed activity for last 7 days', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'aw_get_activity',
          arguments: {
            time_period: 'last_7_days',
            top_n: 3,
            response_format: 'detailed',
            include_browser_details: true,
            include_editor_details: true,
            include_categories: false,
          },
        },
      });

      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      
      const content = JSON.parse(response.result.content[0].text);
      expect(content.total_time_seconds).toBeDefined();
      expect(content.activities).toBeDefined();
      expect(Array.isArray(content.activities)).toBe(true);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle invalid tool name', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'invalid_tool_name',
          arguments: {},
        },
      });

      expect(response.error).toBeDefined();
    });

    it('should handle invalid parameters', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'aw_get_activity',
          arguments: {
            time_period: 'invalid_period',
          },
        },
      });

      expect(response.error).toBeDefined();
    });
  });
});

/**
 * Helper function to send JSON-RPC request to server and wait for response
 */
async function sendRequest(server: ChildProcess, request: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 5000);

    let responseBuffer = '';

    const dataHandler = (data: Buffer) => {
      responseBuffer += data.toString();
      
      const lines = responseBuffer.split('\n');
      responseBuffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            if (message.id === request.id) {
              clearTimeout(timeout);
              server.stdout?.off('data', dataHandler);
              resolve(message);
            }
          } catch (e) {
            // Ignore parse errors for incomplete messages
          }
        }
      }
    };

    server.stdout?.on('data', dataHandler);
    server.stdin?.write(JSON.stringify(request) + '\n');
  });
}

