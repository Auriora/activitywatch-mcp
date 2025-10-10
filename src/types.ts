/**
 * ActivityWatch API Types
 */

export interface AWBucket {
  id: string;
  name?: string;
  type: string;
  client: string;
  hostname: string;
  created: string;
  data?: Record<string, unknown>;
  events?: AWEvent[];
}

export interface AWEvent {
  id?: number;
  timestamp: string;
  duration: number;
  data: Record<string, unknown>;
}

export interface AWServerInfo {
  hostname: string;
  version: string;
  testing: boolean;
  device_id: string;
}

export interface AWQuery {
  query: string[];
  timeperiods: string[];
}

/**
 * Internal processed types
 */

export interface BucketInfo {
  id: string;
  type: string;
  description: string;
  device: string;
  hostname: string;
  client: string;
  created: string;
  dataRange?: {
    earliest: string;
    latest: string;
  };
}

export interface Capabilities {
  has_window_tracking: boolean;
  has_browser_tracking: boolean;
  has_afk_detection: boolean;
  has_categories: boolean;
}

export interface AppUsage {
  name: string;
  duration_seconds: number;
  duration_hours: number;
  percentage: number;
  window_titles?: string[];
}

export interface WebUsage {
  domain: string;
  url?: string;
  title?: string;
  duration_seconds: number;
  duration_hours: number;
  percentage: number;
}

export interface DailySummary {
  date: string;
  total_active_time_hours: number;
  total_afk_time_hours: number;
  top_applications: AppUsage[];
  top_websites: WebUsage[];
  hourly_breakdown?: HourlyActivity[];
  insights: string[];
}

export interface HourlyActivity {
  hour: number;
  active_seconds: number;
  top_app?: string;
  top_website?: string;
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

