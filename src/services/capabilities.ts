/**
 * Service for discovering ActivityWatch capabilities
 */

import { ActivityWatchClient } from '../client/activitywatch.js';
import { BucketInfo, Capabilities, AWError } from '../types.js';
import { formatDateForAPI } from '../utils/time.js';

export class CapabilitiesService {
  constructor(private client: ActivityWatchClient) {}

  /**
   * Get all available buckets with metadata
   */
  async getAvailableBuckets(): Promise<BucketInfo[]> {
    try {
      const buckets = await this.client.getBuckets();
      const bucketInfos: BucketInfo[] = [];

      for (const [id, bucket] of Object.entries(buckets)) {
        const info: BucketInfo = {
          id,
          type: bucket.type,
          description: this.getBucketDescription(bucket.type, bucket.client),
          device: bucket.hostname,
          hostname: bucket.hostname,
          client: bucket.client,
          created: bucket.created,
        };

        // Try to get data range
        try {
          const events = await this.client.getEvents(id, { limit: 1 });
          if (events.length > 0) {
            // Get first and last event
            const allEvents = await this.client.getEvents(id);
            if (allEvents.length > 0) {
              const timestamps = allEvents.map(e => new Date(e.timestamp).getTime());
              info.dataRange = {
                earliest: new Date(Math.min(...timestamps)).toISOString(),
                latest: new Date(Math.max(...timestamps)).toISOString(),
              };
            }
          }
        } catch (error) {
          // Ignore errors getting data range
        }

        bucketInfos.push(info);
      }

      return bucketInfos;
    } catch (error) {
      if (error instanceof AWError) {
        throw error;
      }
      throw new AWError(
        'Failed to get available buckets',
        'BUCKET_DISCOVERY_ERROR',
        { error }
      );
    }
  }

  /**
   * Detect what capabilities are available
   */
  async detectCapabilities(): Promise<Capabilities> {
    const buckets = await this.getAvailableBuckets();

    return {
      has_window_tracking: buckets.some(b => 
        b.type === 'currentwindow' || b.type.includes('window')
      ),
      has_browser_tracking: buckets.some(b => 
        b.type === 'web.tab.current' || b.type.includes('web')
      ),
      has_afk_detection: buckets.some(b => 
        b.type === 'afkstatus' || b.type.includes('afk')
      ),
      has_categories: false, // Categories are configured separately
    };
  }

  /**
   * Get suggested tools based on available data
   */
  async getSuggestedTools(): Promise<string[]> {
    const capabilities = await this.detectCapabilities();
    const tools: string[] = ['aw_get_capabilities', 'aw_get_raw_events'];

    if (capabilities.has_window_tracking) {
      tools.push('aw_get_window_activity');
    }

    if (capabilities.has_browser_tracking) {
      tools.push('aw_get_web_activity');
    }

    if (capabilities.has_window_tracking || capabilities.has_browser_tracking) {
      tools.push('aw_get_daily_summary');
    }

    return tools;
  }

  /**
   * Get human-readable description for bucket type
   */
  private getBucketDescription(type: string, client: string): string {
    const descriptions: Record<string, string> = {
      'currentwindow': 'Active window and application tracking',
      'afkstatus': 'Active/AFK (away from keyboard) status tracking',
      'web.tab.current': 'Browser tab and website tracking',
    };

    if (descriptions[type]) {
      return descriptions[type];
    }

    // Try to infer from type
    if (type.includes('window')) {
      return 'Window activity tracking';
    }
    if (type.includes('web')) {
      return 'Web browsing tracking';
    }
    if (type.includes('afk')) {
      return 'Activity status tracking';
    }

    return `${client} - ${type}`;
  }

  /**
   * Find buckets by type
   */
  async findBucketsByType(type: string): Promise<BucketInfo[]> {
    const buckets = await this.getAvailableBuckets();
    return buckets.filter(b => b.type === type || b.type.includes(type));
  }

  /**
   * Find window tracking buckets
   */
  async findWindowBuckets(): Promise<BucketInfo[]> {
    const buckets = await this.getAvailableBuckets();
    return buckets.filter(b => 
      b.type === 'currentwindow' || b.type.includes('window')
    );
  }

  /**
   * Find browser tracking buckets
   */
  async findBrowserBuckets(): Promise<BucketInfo[]> {
    const buckets = await this.getAvailableBuckets();
    return buckets.filter(b => 
      b.type === 'web.tab.current' || b.type.includes('web')
    );
  }

  /**
   * Find AFK tracking buckets
   */
  async findAfkBuckets(): Promise<BucketInfo[]> {
    const buckets = await this.getAvailableBuckets();
    return buckets.filter(b => 
      b.type === 'afkstatus' || b.type.includes('afk')
    );
  }
}

