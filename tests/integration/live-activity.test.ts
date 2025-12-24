import { beforeAll, describe, it, expect } from 'vitest';

import { ActivityWatchClient } from '../../src/client/activitywatch.js';
import { CapabilitiesService } from '../../src/services/capabilities.js';
import { QueryService } from '../../src/services/query.js';
import { CategoryService } from '../../src/services/category.js';
import { CalendarService } from '../../src/services/calendar.js';
import { UnifiedActivityService } from '../../src/services/unified-activity.js';

const RUN_LIVE = process.env.RUN_LIVE_AW_TESTS === 'true';
const AW_URL = process.env.AW_URL || 'http://localhost:5600';

describe.skipIf(!RUN_LIVE)('Live ActivityWatch integration', () => {
  const client = new ActivityWatchClient(AW_URL);
  const capabilities = new CapabilitiesService(client);
  const categoryService = new CategoryService(client);
  const queryService = new QueryService(client, capabilities);
  const calendarService = new CalendarService(client, capabilities);
  const unifiedService = new UnifiedActivityService(queryService, categoryService, calendarService);

  beforeAll(async () => {
    await categoryService.loadFromActivityWatch();
  });

  it('returns activity grouped by project without timing out', async () => {
    const result = await unifiedService.getActivity({
      time_period: 'last_7_days',
      group_by: 'project',
      top_n: 5,
      min_duration_seconds: 5,
    });

    expect(typeof result.total_time_seconds).toBe('number');
    expect(Array.isArray(result.activities)).toBe(true);
    expect(result.time_range.start).toBeTruthy();
    expect(result.time_range.end).toBeTruthy();
  }, 30000);

  it('returns activity grouped by top-level category without timing out', async () => {
    const result = await unifiedService.getActivity({
      time_period: 'last_7_days',
      group_by: 'category_top_level',
      top_n: 5,
      min_duration_seconds: 5,
    });

    expect(typeof result.total_time_seconds).toBe('number');
    expect(Array.isArray(result.activities)).toBe(true);
    expect(result.time_range.start).toBeTruthy();
    expect(result.time_range.end).toBeTruthy();
  }, 30000);
});
