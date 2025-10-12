/**
 * Mock ActivityWatch Client for testing
 * 
 * Provides a mock implementation of the ActivityWatch client
 * for use in unit and integration tests.
 */

import type { AWBucket, AWEvent } from '../../src/types.js';
import { AWError } from '../../src/types.js';

type MockMethodName = 'getBuckets' | 'getEvents' | 'query' | 'getBucketInfo';

export class MockActivityWatchClient {
  private buckets: Map<string, AWBucket> = new Map();
  private events: Map<string, AWEvent[]> = new Map();
  private queryResponses: Map<string, any> = new Map();
  private methodFailures: Map<MockMethodName, () => Promise<never>> = new Map();

  private async maybeFail(method: MockMethodName): Promise<void> {
    const failure = this.methodFailures.get(method);
    if (failure) {
      await failure();
    }
  }

  /**
   * Set mock buckets
   */
  setBuckets(buckets: AWBucket[]): void {
    this.buckets.clear();
    buckets.forEach(bucket => {
      this.buckets.set(bucket.id, bucket);
    });
  }

  /**
   * Set mock events for a bucket
   */
  setEvents(bucketId: string, events: AWEvent[]): void {
    this.events.set(bucketId, events);
  }

  /**
   * Set mock query response
   */
  setQueryResponse(query: string, response: any): void {
    this.queryResponses.set(query, response);
  }

  setMethodError(method: MockMethodName, error: Error | (() => Error)): void {
    this.methodFailures.set(method, async () => {
      throw typeof error === 'function' ? error() : error;
    });
  }

  setMethodTimeout(method: MockMethodName, timeoutMs: number = 30000, path?: string): void {
    this.methodFailures.set(method, async () => {
      throw createTimeoutError(timeoutMs, path ?? method);
    });
  }

  clearMethodFailures(): void {
    this.methodFailures.clear();
  }

  /**
   * Mock getBuckets implementation
   */
  async getBuckets(): Promise<Record<string, AWBucket>> {
    await this.maybeFail('getBuckets');
    const result: Record<string, AWBucket> = {};
    this.buckets.forEach((bucket, id) => {
      result[id] = bucket;
    });
    return result;
  }

  /**
   * Mock getEvents implementation
   */
  async getEvents(
    bucketId: string,
    params?: { start?: string | Date; end?: string | Date; limit?: number }
  ): Promise<AWEvent[]> {
    await this.maybeFail('getEvents');
    // Apply filters if provided
    let filtered = this.events.get(bucketId) || [];
    
    if (params?.start) {
      const startDate = typeof params.start === 'string'
        ? new Date(params.start)
        : params.start;
      filtered = filtered.filter(e => new Date(e.timestamp) >= startDate!);
    }
    
    if (params?.end) {
      const endDate = typeof params.end === 'string'
        ? new Date(params.end)
        : params.end;
      filtered = filtered.filter(e => new Date(e.timestamp) <= endDate!);
    }
    
    if (params?.limit) {
      filtered = filtered.slice(0, params.limit);
    }
    
    return filtered;
  }

  /**
   * Mock query implementation
   */
  async query(
    timeperiods: Array<{ start: Date; end: Date }>,
    query: string[]
  ): Promise<any[]> {
    await this.maybeFail('query');
    const queryKey = query.join('\n');
    const response = this.queryResponses.get(queryKey);
    
    if (response !== undefined) {
      return Array.isArray(response) ? response : [response];
    }
    
    // Default empty response
    return [];
  }

  /**
   * Mock getBucketInfo implementation
   */
  async getBucketInfo(bucketId: string): Promise<AWBucket | null> {
    await this.maybeFail('getBucketInfo');
    return this.buckets.get(bucketId) || null;
  }

  /**
   * Clear all mock data
   */
  clear(): void {
    this.buckets.clear();
    this.events.clear();
    this.queryResponses.clear();
    this.clearMethodFailures();
  }
}

/**
 * Create a mock bucket
 */
export function createMockBucket(
  id: string,
  type: string,
  hostname: string = 'test-host'
): AWBucket {
  return {
    id,
    name: id,
    type,
    client: 'test-client',
    hostname,
    created: new Date().toISOString(),
    data: {},
  };
}

/**
 * Create a mock event
 */
export function createMockEvent(
  timestamp: string,
  duration: number,
  data: Record<string, any>
): AWEvent {
  return {
    id: Math.floor(Math.random() * 1000000),
    timestamp,
    duration,
    data,
  };
}

/**
 * Create mock window events
 */
export function createMockWindowEvents(count: number = 5): AWEvent[] {
  const apps = ['Chrome', 'VS Code', 'Terminal', 'Slack', 'Firefox'];
  const events: AWEvent[] = [];
  
  let timestamp = new Date('2025-01-01T09:00:00Z');
  
  for (let i = 0; i < count; i++) {
    events.push(createMockEvent(
      timestamp.toISOString(),
      60 + Math.random() * 300, // 1-5 minutes
      {
        app: apps[i % apps.length],
        title: `Test Window ${i + 1}`,
      }
    ));
    
    timestamp = new Date(timestamp.getTime() + (60 + Math.random() * 300) * 1000);
  }
  
  return events;
}

/**
 * Create mock browser events
 */
export function createMockBrowserEvents(count: number = 5): AWEvent[] {
  const domains = ['github.com', 'stackoverflow.com', 'google.com', 'reddit.com', 'youtube.com'];
  const events: AWEvent[] = [];
  
  let timestamp = new Date('2025-01-01T09:00:00Z');
  
  for (let i = 0; i < count; i++) {
    const domain = domains[i % domains.length];
    events.push(createMockEvent(
      timestamp.toISOString(),
      60 + Math.random() * 300,
      {
        url: `https://${domain}/page${i + 1}`,
        title: `Test Page ${i + 1}`,
        audible: false,
        incognito: false,
        tabCount: 5,
      }
    ));
    
    timestamp = new Date(timestamp.getTime() + (60 + Math.random() * 300) * 1000);
  }
  
  return events;
}

/**
 * Create mock AFK events
 */
export function createMockAFKEvents(
  activeCount: number = 3,
  afkCount: number = 2
): AWEvent[] {
  const events: AWEvent[] = [];
  let timestamp = new Date('2025-01-01T09:00:00Z');
  
  for (let i = 0; i < activeCount + afkCount; i++) {
    const isActive = i % 2 === 0;
    events.push(createMockEvent(
      timestamp.toISOString(),
      isActive ? 300 : 60, // 5 min active, 1 min AFK
      {
        status: isActive ? 'not-afk' : 'afk',
      }
    ));
    
    timestamp = new Date(timestamp.getTime() + (isActive ? 300 : 60) * 1000);
  }
  
  return events;
}

export function createApiError(
  status: number,
  statusText: string = 'Internal Server Error',
  body: string = ''
): AWError {
  return new AWError(
    `ActivityWatch API error: ${status} ${statusText}`,
    'API_ERROR',
    { status, statusText, body }
  );
}

export function createTimeoutError(
  timeoutMs: number,
  path: string
): AWError {
  return new AWError(
    `Request to ActivityWatch timed out after ${timeoutMs}ms`,
    'TIMEOUT_ERROR',
    { timeout: timeoutMs, path }
  );
}

export function createConnectionError(message: string): AWError {
  return new AWError(
    `Failed to connect to ActivityWatch: ${message}`,
    'CONNECTION_ERROR',
    { originalError: message }
  );
}

export function createAbortError(message: string = 'The operation was aborted'): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException(message, 'AbortError');
  }

  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}
