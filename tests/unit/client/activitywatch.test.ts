import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityWatchClient } from '../../../src/client/activitywatch.js';
import { AWError } from '../../../src/types.js';
import {
  createAbortError,
  createApiError,
  createConnectionError,
  createTimeoutError,
} from '../../helpers/mock-client.js';

describe('ActivityWatchClient', () => {
  const baseUrl = 'http://aw.test';
  const requestTimeout = 100;
  const originalFetch = globalThis.fetch;
  let client: ActivityWatchClient;

  const setFetchMock = <T extends (...args: any[]) => any>(implementation: T) => {
    const mock = vi.fn(implementation);
    globalThis.fetch = mock as unknown as typeof globalThis.fetch;
    return mock;
  };

  beforeEach(() => {
    client = new ActivityWatchClient(baseUrl, requestTimeout);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fetches server info via GET', async () => {
    const payload = { version: '0.1' };
    const fetchMock = setFetchMock(() =>
      Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }))
    );

    const result = await client.getServerInfo();
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/api/0/info`,
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toEqual(payload);
  });

  it('returns parsed data for successful requests', async () => {
    const payload = { buckets: ['one', 'two'] };
    const fetchMock = setFetchMock(() =>
      Promise.resolve(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const result = await client.getBuckets();

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/api/0/buckets/`,
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toEqual(payload);
  });

  it('wraps HTTP errors in AWError instances', async () => {
    const body = 'Internal Server Error';
    const response = new Response(body, { status: 500, statusText: 'Server Error' });
    setFetchMock(() => Promise.resolve(response));

    const expected = createApiError(500, 'Server Error', body);

    await client.getBuckets().then(
      () => {
        throw new Error('Expected request to reject');
      },
      error => {
        expect(error).toBeInstanceOf(AWError);
        expect(error).toMatchObject({
          message: expected.message,
          code: expected.code,
          details: expected.details,
        });
      }
    );
  });

  it('converts aborts into timeout AWErrors', async () => {
    client = new ActivityWatchClient(baseUrl, 10);
    setFetchMock((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(createAbortError()));
      });
    });

    await client.getBuckets().then(
      () => {
        throw new Error('Expected timeout error');
      },
      error => {
        const expected = createTimeoutError(10, '/api/0/buckets/');
        expect(error).toBeInstanceOf(AWError);
        expect(error).toMatchObject({
          message: expected.message,
          code: expected.code,
          details: expected.details,
        });
      }
    );
  });

  it('wraps network failures as connection errors', async () => {
    setFetchMock(() => Promise.reject(new TypeError('Network down')));

    await client.getBuckets().then(
      () => {
        throw new Error('Expected connection error');
      },
      error => {
        const expected = createConnectionError('Network down');
        expect(error).toBeInstanceOf(AWError);
        expect(error).toMatchObject({
          message: expected.message,
          code: expected.code,
          details: expected.details,
        });
      }
    );
  });

  it('fetches events with query params applied', async () => {
    const fetchMock = setFetchMock(() =>
      Promise.resolve(
        new Response(JSON.stringify([{ id: 1 }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await client.getEvents('aw-watcher-window_test', {
      start: '2025-01-01T00:00:00.000Z',
      end: '2025-01-02T00:00:00.000Z',
      limit: 5,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/api/0/buckets/aw-watcher-window_test/events?start=2025-01-01T00%3A00%3A00.000Z&end=2025-01-02T00%3A00%3A00.000Z&limit=5`,
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('fetches event count with optional range', async () => {
    const fetchMock = setFetchMock(() =>
      Promise.resolve(
        new Response(JSON.stringify(42), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const count = await client.getEventCount('aw-watcher-window_test', {
      start: '2025-01-01T00:00:00.000Z',
      end: '2025-01-02T00:00:00.000Z',
    });

    expect(count).toBe(42);
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/api/0/buckets/aw-watcher-window_test/events/count?start=2025-01-01T00%3A00%3A00.000Z&end=2025-01-02T00%3A00%3A00.000Z`,
      expect.anything()
    );
  });

  it('executes query with POST payload', async () => {
    const fetchMock = setFetchMock(() =>
      Promise.resolve(
        new Response(JSON.stringify([{ result: true }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const query = ['events = query_bucket("aw");', 'RETURN = events;'];
    const timeperiods = ['2025-01-01T00:00:00Z/2025-01-02T00:00:00Z'];

    const result = await client.query(timeperiods, query);
    expect(result).toEqual([{ result: true }]);

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/api/0/query/`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          timeperiods,
          query,
        }),
      })
    );
  });

  it('exposes settings helpers for global and scoped keys', async () => {
    const responses = [
      new Response(JSON.stringify({ theme: 'dark' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
      new Response(JSON.stringify({ value: 'nested' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
      new Response('null', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ];

    const fetchMock = setFetchMock(() => Promise.resolve(responses.shift()!));

    const allSettings = await client.getSettings();
    expect(allSettings).toEqual({ theme: 'dark' });

    const scopedSettings = await client.getSettings('appearance');
    expect(scopedSettings).toEqual({ value: 'nested' });

    await client.updateSettings('appearance', { value: 'nested' });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${baseUrl}/api/0/settings`);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${baseUrl}/api/0/settings/appearance`);
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/api/0/settings/appearance`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ value: 'nested' }),
      })
    );
  });

  it('wraps JSON parse failures as connection errors', async () => {
    setFetchMock(() =>
      Promise.resolve(
        new Response('not-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await client.getBuckets().then(
      () => {
        throw new Error('Expected JSON parse error');
      },
      error => {
        expect(error).toBeInstanceOf(AWError);
        expect(error.code).toBe('CONNECTION_ERROR');
      }
    );
  });

  it('wraps unknown rejection values as AWError', async () => {
    setFetchMock(() => Promise.reject('unexpected'));

    await client.getBuckets().then(
      () => {
        throw new Error('Expected unknown error');
      },
      error => {
        expect(error).toBeInstanceOf(AWError);
        expect(error.code).toBe('UNKNOWN_ERROR');
      }
    );
  });
});
