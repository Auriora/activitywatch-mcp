import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { createHttpServer } from '../../src/http-server.js';
import { logger } from '../../src/utils/logger.js';

describe('HTTP server resource logging', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.MCP_RESOURCE_LOG_INTERVAL = '1';
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.MCP_RESOURCE_LOG_INTERVAL;
    vi.restoreAllMocks();
  });

  it('captures periodic resource snapshots when enabled', async () => {
    const debugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => {});

    const instance = createHttpServer({ enableResourceLogging: true });
    vi.advanceTimersByTime(5);

    expect(debugSpy).toHaveBeenCalledWith('Resource usage snapshot', expect.any(Object));

    await instance.closeAllSessions('test');
  });
});
