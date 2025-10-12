import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { performHealthCheck, formatHealthCheckResult } from '../../../src/utils/health.js';
import { AWError } from '../../../src/types.js';
import { logger } from '../../../src/utils/logger.js';

const createMockClient = () => ({
  getServerInfo: vi.fn(),
  getBuckets: vi.fn(),
});

describe('performHealthCheck', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns healthy result when server reachable and trackers available', async () => {
    const client = createMockClient();
    client.getServerInfo.mockResolvedValue({ version: '0.10.0' });
    client.getBuckets.mockResolvedValue({
      'aw-watcher-window': { type: 'currentwindow' },
      'aw-watcher-web': { type: 'web.tab.current' },
      'aw-watcher-afk': { type: 'afkstatus' },
    });

    const result = await performHealthCheck(client as any);

    expect(result).toMatchObject({
      healthy: true,
      serverReachable: true,
      serverVersion: '0.10.0',
      bucketsAvailable: 3,
      hasWindowTracking: true,
      hasBrowserTracking: true,
      hasAfkTracking: true,
      errors: [],
      warnings: [],
    });
  });

  it('flags server as unreachable and stops checks on failure', async () => {
    const client = createMockClient();
    client.getServerInfo.mockRejectedValue(new Error('Connection refused'));

    const result = await performHealthCheck(client as any);

    expect(result.healthy).toBe(false);
    expect(result.serverReachable).toBe(false);
    expect(result.errors).toContain('Cannot connect to ActivityWatch server. Is it running?');
    expect(client.getBuckets).not.toHaveBeenCalled();
  });

  it('captures bucket retrieval errors', async () => {
    const client = createMockClient();
    client.getServerInfo.mockResolvedValue({ version: '0.10.0' });
    client.getBuckets.mockRejectedValue(new AWError('Buckets failure', 'API_ERROR'));

    const result = await performHealthCheck(client as any);

    expect(result.healthy).toBe(false);
    expect(result.errors).toContain('Failed to retrieve buckets from ActivityWatch');
  });

  it('adds warnings for missing tracking watchers', async () => {
    const client = createMockClient();
    client.getServerInfo.mockResolvedValue({ version: '0.10.0' });
    client.getBuckets.mockResolvedValue({ 'aw-watcher-afk': { type: 'afkstatus' } });

    const result = await performHealthCheck(client as any);

    expect(result.warnings).toEqual([
      'Window tracking not available. Install aw-watcher-window for application tracking.',
      'Browser tracking not available. Install aw-watcher-web for website tracking.',
    ]);
    expect(result.hasAfkTracking).toBe(true);
    expect(result.hasWindowTracking).toBe(false);
    expect(result.hasBrowserTracking).toBe(false);
  });
});

describe('formatHealthCheckResult', () => {
  it('renders health summary with errors and warnings', () => {
    const formatted = formatHealthCheckResult({
      healthy: false,
      serverReachable: true,
      serverVersion: '0.9.9',
      bucketsAvailable: 0,
      hasWindowTracking: false,
      hasBrowserTracking: false,
      hasAfkTracking: true,
      errors: ['Cannot connect to bucket provider'],
      warnings: ['No data buckets found. ActivityWatch may be newly installed or watchers not running.'],
    });

    expect(formatted).toContain('Status: ✗ Unhealthy');
    expect(formatted).toContain('Server Version: 0.9.9');
    expect(formatted).toContain('Buckets Available: 0');
    expect(formatted).toContain('Window Tracking: ✗ Not Available');
    expect(formatted).toContain('Browser Tracking: ✗ Not Available');
    expect(formatted).toContain('AFK Tracking: ✓ Available');
    expect(formatted).toContain('Errors:');
    expect(formatted).toContain('✗ Cannot connect to bucket provider');
    expect(formatted).toContain('Warnings:');
    expect(formatted).toContain('⚠ No data buckets found. ActivityWatch may be newly installed or watchers not running.');
  });

  it('renders healthy summary without optional sections', () => {
    const formatted = formatHealthCheckResult({
      healthy: true,
      serverReachable: true,
      serverVersion: undefined,
      bucketsAvailable: 2,
      hasWindowTracking: true,
      hasBrowserTracking: true,
      hasAfkTracking: false,
      errors: [],
      warnings: [],
    });

    expect(formatted).toContain('Status: ✓ Healthy');
    expect(formatted).toContain('Server Reachable: ✓ Yes');
    expect(formatted).toContain('Buckets Available: 2');
    expect(formatted).not.toContain('Errors:');
    expect(formatted).not.toContain('Warnings:');
  });
});
