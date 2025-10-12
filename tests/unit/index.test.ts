import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

const modulePath = '../../src/index.js';

describe('stdio entrypoint', () => {
  const loadModule = async () => import(modulePath);

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('connects stdio transport when startup succeeds', async () => {
    const serverConnect = vi.fn().mockResolvedValue(undefined);
    const transportInstance = { connect: vi.fn() };
    const transportCtor = vi.fn().mockReturnValue(transportInstance);

    vi.doMock('../../src/server-factory.js', () => ({
      createMCPServer: vi.fn().mockResolvedValue({ connect: serverConnect }),
    }));
    vi.doMock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
      StdioServerTransport: transportCtor,
    }));
    vi.doMock('../../src/utils/health.js', () => ({
      logStartupDiagnostics: vi.fn(),
    }));
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
    vi.doMock('../../src/utils/logger.js', () => ({
      logger,
    }));

    await loadModule();
    await new Promise(setImmediate);

    expect(transportCtor).toHaveBeenCalled();
    expect(serverConnect).toHaveBeenCalledWith(transportInstance);
    expect(process.exitCode).toBeUndefined();
  });

  it('sets exit code when startup fails', async () => {
    const originalExitCode = process.exitCode;
    process.exitCode = undefined;

    vi.doMock('../../src/server-factory.js', () => ({
      createMCPServer: vi.fn().mockRejectedValue(new Error('boom')),
    }));
    vi.doMock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
      StdioServerTransport: vi.fn(),
    }));
    vi.doMock('../../src/utils/health.js', () => ({
      logStartupDiagnostics: vi.fn(),
    }));
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
    vi.doMock('../../src/utils/logger.js', () => ({
      logger,
    }));

    await loadModule();
    await new Promise(setImmediate);

    expect(process.exitCode).toBe(1);
    process.exitCode = originalExitCode;
  });
});
