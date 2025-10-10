/**
 * ActivityWatch API Types
 */

export interface AWBucket {
  readonly id: string;
  readonly name?: string;
  readonly type: string;
  readonly client: string;
  readonly hostname: string;
  readonly created: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly events?: readonly AWEvent[];
}

export interface AWEvent {
  readonly id?: number;
  readonly timestamp: string;
  readonly duration: number;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface AWServerInfo {
  readonly hostname: string;
  readonly version: string;
  readonly testing: boolean;
  readonly device_id: string;
}

export interface AWQuery {
  readonly query: readonly string[];
  readonly timeperiods: readonly string[];
}

/**
 * Internal processed types
 */

export interface BucketInfo {
  readonly id: string;
  readonly type: string;
  readonly description: string;
  readonly device: string;
  readonly hostname: string;
  readonly client: string;
  readonly created: string;
  readonly dataRange?: {
    readonly earliest: string;
    readonly latest: string;
  };
}

export interface Capabilities {
  readonly has_window_tracking: boolean;
  readonly has_browser_tracking: boolean;
  readonly has_afk_detection: boolean;
  readonly has_categories: boolean;
}

export interface AppUsage {
  readonly name: string;
  readonly duration_seconds: number;
  readonly duration_hours: number;
  readonly percentage: number;
  readonly window_titles?: readonly string[];
}

export interface WebUsage {
  readonly domain: string;
  readonly url?: string;
  readonly title?: string;
  readonly duration_seconds: number;
  readonly duration_hours: number;
  readonly percentage: number;
}

export interface CategoryUsage {
  readonly category_name: string;
  readonly duration_seconds: number;
  readonly duration_hours: number;
  readonly percentage: number;
  readonly event_count: number;
}

export interface DailySummary {
  readonly date: string;
  readonly total_active_time_hours: number;
  readonly total_afk_time_hours: number;
  readonly top_applications: readonly AppUsage[];
  readonly top_websites: readonly WebUsage[];
  readonly top_categories?: readonly CategoryUsage[];
  readonly hourly_breakdown?: readonly HourlyActivity[];
  readonly insights: readonly string[];
}

export interface HourlyActivity {
  readonly hour: number;
  readonly active_seconds: number;
  readonly top_app?: string;
  readonly top_website?: string;
}

/**
 * Time period types
 */

export type TimePeriod = 
  | 'today' 
  | 'yesterday' 
  | 'this_week' 
  | 'last_week' 
  | 'last_7_days' 
  | 'last_30_days' 
  | 'custom';

export type ResponseFormat = 'concise' | 'detailed' | 'raw';

export type GroupBy = 'application' | 'title' | 'both' | 'domain' | 'url';

/**
 * Tool parameter types
 */

export interface TimeRangeParams {
  time_period: TimePeriod;
  custom_start?: string;
  custom_end?: string;
}

export interface WindowActivityParams extends TimeRangeParams {
  top_n?: number;
  group_by?: 'application' | 'title' | 'both';
  response_format?: ResponseFormat;
  exclude_system_apps?: boolean;
  min_duration_seconds?: number;
}

export interface WebActivityParams extends TimeRangeParams {
  top_n?: number;
  group_by?: 'domain' | 'url' | 'title';
  response_format?: ResponseFormat;
  exclude_domains?: string[];
  min_duration_seconds?: number;
}

export interface DailySummaryParams {
  date?: string;
  include_hourly_breakdown?: boolean;
}

export interface RawEventsParams {
  bucket_id: string;
  start_time: string;
  end_time: string;
  limit?: number;
  response_format?: ResponseFormat;
}

/**
 * Error types
 */

export class AWError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AWError';
  }
}

