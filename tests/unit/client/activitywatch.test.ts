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
});
