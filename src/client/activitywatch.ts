/**
 * ActivityWatch API Client
 */

import { AWBucket, AWEvent, AWServerInfo, AWError } from '../types.js';
import { logger } from '../utils/logger.js';

/**
 * Interface for ActivityWatch client operations
 * Enables dependency injection and easier testing
 */
export interface IActivityWatchClient {
  getServerInfo(): Promise<AWServerInfo>;
  getBuckets(): Promise<Record<string, AWBucket>>;
  getBucket(bucketId: string): Promise<AWBucket>;
  getEvents(
    bucketId: string,
    params?: {
      start?: string;
      end?: string;
      limit?: number;
    }
  ): Promise<AWEvent[]>;
  getEventCount(
    bucketId: string,
    params?: {
      start?: string;
      end?: string;
    }
  ): Promise<number>;
  query(timeperiods: string[], query: string[]): Promise<unknown[]>;
}

export class ActivityWatchClient implements IActivityWatchClient {
  private baseUrl: string;
  private readonly defaultTimeout: number = 30000; // 30 seconds

  constructor(baseUrl: string = 'http://localhost:5600', timeout?: number) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    if (timeout !== undefined) {
      this.defaultTimeout = timeout;
    }
  }

  /**
   * Get server info
   */
  async getServerInfo(): Promise<AWServerInfo> {
    return this.request<AWServerInfo>('/api/0/info');
  }

  /**
   * Get all buckets
   */
  async getBuckets(): Promise<Record<string, AWBucket>> {
    return this.request<Record<string, AWBucket>>('/api/0/buckets/');
  }

  /**
   * Get a specific bucket
   */
  async getBucket(bucketId: string): Promise<AWBucket> {
    return this.request<AWBucket>(`/api/0/buckets/${encodeURIComponent(bucketId)}`);
  }

  /**
   * Get events from a bucket
   */
  async getEvents(
    bucketId: string,
    params?: {
      start?: string;
      end?: string;
      limit?: number;
    }
  ): Promise<AWEvent[]> {
    const queryParams = new URLSearchParams();
    if (params?.start) queryParams.set('start', params.start);
    if (params?.end) queryParams.set('end', params.end);
    if (params?.limit) queryParams.set('limit', params.limit.toString());

    const url = `/api/0/buckets/${encodeURIComponent(bucketId)}/events${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;

    return this.request<AWEvent[]>(url);
  }

  /**
   * Get event count from a bucket
   */
  async getEventCount(
    bucketId: string,
    params?: {
      start?: string;
      end?: string;
    }
  ): Promise<number> {
    const queryParams = new URLSearchParams();
    if (params?.start) queryParams.set('start', params.start);
    if (params?.end) queryParams.set('end', params.end);

    const url = `/api/0/buckets/${encodeURIComponent(bucketId)}/events/count${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;

    return this.request<number>(url);
  }

  /**
   * Execute a query
   */
  async query(
    timeperiods: string[],
    query: string[]
  ): Promise<unknown[]> {
    return this.request<unknown[]>('/api/0/query/', {
      method: 'POST',
      body: JSON.stringify({
        timeperiods,
        query,
      }),
    });
  }

  /**
   * Make a request to the ActivityWatch API
   */
  private async request<T>(
    path: string,
    options?: {
      method?: string;
      body?: string;
      headers?: Record<string, string>;
      timeout?: number;
    }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const method = options?.method || 'GET';
    const timeout = options?.timeout ?? this.defaultTimeout;

    logger.debug(`API request: ${method} ${path}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          body: options?.body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          logger.error(`API error: ${method} ${path}`, {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          });
          throw new AWError(
            `ActivityWatch API error: ${response.status} ${response.statusText}`,
            'API_ERROR',
            { status: response.status, statusText: response.statusText, body: errorText }
          );
        }

        logger.debug(`API response: ${method} ${path} - ${response.status}`);
        return await response.json() as T;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof AWError) {
        throw error;
      }

      // Handle timeout errors
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(`Request timeout: ${method} ${path}`, { timeout });
        throw new AWError(
          `Request to ActivityWatch timed out after ${timeout}ms`,
          'TIMEOUT_ERROR',
          { timeout, path }
        );
      }

      // Network or other errors
      if (error instanceof Error) {
        logger.error(`Connection error: ${method} ${path}`, error);
        throw new AWError(
          `Failed to connect to ActivityWatch: ${error.message}`,
          'CONNECTION_ERROR',
          { originalError: error.message }
        );
      }

      logger.error(`Unknown error: ${method} ${path}`, error);
      throw new AWError(
        'Unknown error connecting to ActivityWatch',
        'UNKNOWN_ERROR',
        { error }
      );
    }
  }
}

