/**
 * Integration tests for Query Builder Service
 * 
 * These tests verify the query builder functionality with mocked ActivityWatch client.
 * For E2E tests with real ActivityWatch server, see tests/e2e/
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryBuilderService } from '../../src/services/query-builder.js';
import { CapabilitiesService } from '../../src/services/capabilities.js';
import { MockActivityWatchClient, createMockBucket } from '../helpers/mock-client.js';

describe('QueryBuilderService Integration', () => {
  let mockClient: MockActivityWatchClient;
  let capabilitiesService: CapabilitiesService;
  let queryBuilderService: QueryBuilderService;

  beforeEach(() => {
    mockClient = new MockActivityWatchClient();
    capabilitiesService = new CapabilitiesService(mockClient as any);
    queryBuilderService = new QueryBuilderService(mockClient as any, capabilitiesService);

    // Set up mock buckets
    mockClient.setBuckets([
      createMockBucket('aw-watcher-window_test-host', 'currentwindow'),
      createMockBucket('aw-watcher-afk_test-host', 'afkstatus'),
      createMockBucket('aw-watcher-web-chrome_test-host', 'web.tab.current'),
    ]);
  });

  describe('Window Query with AFK Filtering', () => {
    it('should build query for window events with AFK filtering', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Mock query response
      mockClient.setQueryResponse(
        expect.any(String),
        [
          {
            app: 'Chrome',
            title: 'Test Page',
            duration: 300,
          },
          {
            app: 'VS Code',
            title: 'test.ts',
            duration: 600,
          },
        ]
      );

      const result = await queryBuilderService.queryEvents({
        query_type: 'window',
        start_time: oneHourAgo.toISOString(),
        end_time: now.toISOString(),
        filter_afk: true,
        merge_events: true,
        min_duration_seconds: 5,
        limit: 10,
        response_format: 'detailed',
      });

      expect(result.events).toBeDefined();
      expect(result.total_duration_seconds).toBeGreaterThanOrEqual(0);
      expect(result.buckets_queried).toContain('aw-watcher-window_test-host');
      expect(result.query_used).toBeDefined();
      expect(Array.isArray(result.query_used)).toBe(true);
    });

    it('should handle queries without AFK filtering', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const result = await queryBuilderService.queryEvents({
        query_type: 'window',
        start_time: oneHourAgo.toISOString(),
        end_time: now.toISOString(),
        filter_afk: false,
        merge_events: true,
        limit: 10,
        response_format: 'detailed',
      });

      expect(result).toBeDefined();
      expect(result.buckets_queried).toBeDefined();
    });
  });

  describe('Browser Query', () => {
    it('should build query for browser events', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      mockClient.setQueryResponse(
        expect.any(String),
        [
          {
            url: 'https://github.com',
            title: 'GitHub',
            duration: 400,
          },
        ]
      );

      const result = await queryBuilderService.queryEvents({
        query_type: 'browser',
        start_time: oneHourAgo.toISOString(),
        end_time: now.toISOString(),
        filter_afk: true,
        merge_events: true,
        limit: 5,
        response_format: 'detailed',
      });

      expect(result.events).toBeDefined();
      expect(result.buckets_queried).toContain('aw-watcher-web-chrome_test-host');
    });

    it('should handle missing browser buckets gracefully', async () => {
      // Remove browser bucket
      mockClient.setBuckets([
        createMockBucket('aw-watcher-window_test-host', 'currentwindow'),
        createMockBucket('aw-watcher-afk_test-host', 'afkstatus'),
      ]);

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      await expect(
        queryBuilderService.queryEvents({
          query_type: 'browser',
          start_time: oneHourAgo.toISOString(),
          end_time: now.toISOString(),
          filter_afk: true,
          merge_events: true,
          limit: 5,
          response_format: 'detailed',
        })
      ).rejects.toThrow();
    });
  });

  describe('Custom Query', () => {
    it('should execute custom query', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const bucketId = 'aw-watcher-window_test-host';

      mockClient.setQueryResponse(
        `events = query_bucket("${bucketId}");\nRETURN = events;`,
        [
          { app: 'Test', title: 'Test Window', duration: 100 },
        ]
      );

      const result = await queryBuilderService.queryEvents({
        query_type: 'custom',
        start_time: oneHourAgo.toISOString(),
        end_time: now.toISOString(),
        custom_query: [
          `events = query_bucket("${bucketId}");`,
          `RETURN = events;`,
        ],
        bucket_ids: [bucketId],
        limit: 5,
        response_format: 'detailed',
      });

      expect(result.events).toBeDefined();
      expect(result.query_used).toEqual([
        `events = query_bucket("${bucketId}");`,
        `RETURN = events;`,
      ]);
    });
  });

  describe('App Filtering', () => {
    it('should filter events by app names', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      mockClient.setQueryResponse(
        expect.any(String),
        [
          { app: 'Chrome', title: 'Test', duration: 100 },
          { app: 'VS Code', title: 'test.ts', duration: 200 },
        ]
      );

      const result = await queryBuilderService.queryEvents({
        query_type: 'window',
        start_time: oneHourAgo.toISOString(),
        end_time: now.toISOString(),
        filter_afk: true,
        filter_apps: ['Chrome', 'Firefox', 'Safari', 'Code', 'Visual Studio Code'],
        merge_events: true,
        limit: 10,
        response_format: 'detailed',
      });

      expect(result.events).toBeDefined();
      expect(result.total_duration_seconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Response Formats', () => {
    it('should return concise format', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const result = await queryBuilderService.queryEvents({
        query_type: 'window',
        start_time: oneHourAgo.toISOString(),
        end_time: now.toISOString(),
        filter_afk: true,
        merge_events: true,
        limit: 10,
        response_format: 'concise',
      });

      expect(result).toBeDefined();
    });

    it('should return detailed format', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const result = await queryBuilderService.queryEvents({
        query_type: 'window',
        start_time: oneHourAgo.toISOString(),
        end_time: now.toISOString(),
        filter_afk: true,
        merge_events: true,
        limit: 10,
        response_format: 'detailed',
      });

      expect(result.events).toBeDefined();
      expect(result.total_duration_seconds).toBeDefined();
      expect(result.buckets_queried).toBeDefined();
      expect(result.query_used).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid time range', async () => {
      await expect(
        queryBuilderService.queryEvents({
          query_type: 'window',
          start_time: 'invalid-date',
          end_time: new Date().toISOString(),
          filter_afk: true,
          merge_events: true,
          limit: 10,
          response_format: 'detailed',
        })
      ).rejects.toThrow();
    });

    it('should handle missing required parameters', async () => {
      await expect(
        queryBuilderService.queryEvents({
          query_type: 'custom',
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          // Missing custom_query and bucket_ids
          limit: 10,
          response_format: 'detailed',
        } as any)
      ).rejects.toThrow();
    });
  });
});

