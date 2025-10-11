/**
 * Mock ActivityWatch Client for testing
 * 
 * Provides a mock implementation of the ActivityWatch client
 * for use in unit and integration tests.
 */

import type { AWBucket, AWEvent } from '../../src/types.js';

export class MockActivityWatchClient {
  private buckets: Map<string, AWBucket> = new Map();
  private events: Map<string, AWEvent[]> = new Map();
  private queryResponses: Map<string, any> = new Map();

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

  /**
   * Mock getBuckets implementation
   */
  async getBuckets(): Promise<Record<string, AWBucket>> {
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
    const events = this.events.get(bucketId) || [];
    
    // Apply filters if provided
    let filtered = events;
    
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
    return this.buckets.get(bucketId) || null;
  }

  /**
   * Clear all mock data
   */
  clear(): void {
    this.buckets.clear();
    this.events.clear();
    this.queryResponses.clear();
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
