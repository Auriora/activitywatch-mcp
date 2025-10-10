/**
 * Service for category-based activity analysis
 *
 * Categories in ActivityWatch are user-defined rules that match events
 * based on app names and window titles using regex patterns.
 *
 * This service integrates with ActivityWatch's native category storage,
 * reading and writing categories to the server's settings.
 */

import { AWEvent } from '../types.js';
import { logger } from '../utils/logger.js';
import { getStringProperty } from '../utils/type-guards.js';
import { IActivityWatchClient } from '../client/activitywatch.js';

export interface CategoryRule {
  readonly type: 'regex' | 'none';
  readonly regex?: string;
  readonly ignore_case?: boolean;
}

export interface CategoryData {
  readonly color?: string; // Hex color code like "#FF0000"
  readonly score?: number; // Productivity score (optional)
}

export interface Category {
  readonly id: number;
  readonly name: readonly string[]; // Hierarchical name like ["Work", "Email"]
  readonly rule: CategoryRule;
  readonly data?: CategoryData; // Optional metadata like color and score
}

export interface CategoryUsage {
  readonly category_name: string;
  readonly duration_seconds: number;
  readonly duration_hours: number;
  readonly percentage: number;
  readonly event_count: number;
}

export class CategoryService {
  private categories: Category[] = [];
  private client: IActivityWatchClient;

  constructor(client: IActivityWatchClient) {
    this.client = client;
  }

  /**
   * Load categories from ActivityWatch server settings
   * Falls back to environment variable if server categories are not available
   */
  async loadFromActivityWatch(): Promise<void> {
    try {
      const settings = await this.client.getSettings();
      if (settings.classes && Array.isArray(settings.classes)) {
        this.setCategories(settings.classes);
        logger.info(`Loaded ${settings.classes.length} categories from ActivityWatch server`);
        return;
      }
    } catch (error) {
      logger.warn('Could not load categories from ActivityWatch server, trying environment variable', error);
    }

    // Fall back to environment variable
    const envCategories = process.env.AW_CATEGORIES;
    if (envCategories) {
      try {
        const categories = JSON.parse(envCategories);
        this.setCategories(categories);
        logger.info(`Loaded ${categories.length} categories from environment variable`);
      } catch (error) {
        logger.error('Failed to parse AW_CATEGORIES environment variable', error);
      }
    } else {
      logger.info('No categories configured (neither in ActivityWatch nor environment variable)');
    }
  }

  /**
   * Save categories to ActivityWatch server settings
   */
  async saveToActivityWatch(): Promise<void> {
    try {
      await this.client.updateSettings('classes', this.categories);
      logger.info(`Saved ${this.categories.length} categories to ActivityWatch server`);
    } catch (error) {
      logger.error('Failed to save categories to ActivityWatch server', error);
      throw error;
    }
  }

  /**
   * Set categories to use for classification
   * Categories must be provided by the caller (from user config, file, etc.)
   */
  setCategories(categories: Category[]): void {
    this.categories = categories;
    logger.info(`Set ${categories.length} categories`);
  }

  /**
   * Get current categories
   */
  getCategories(): readonly Category[] {
    return this.categories;
  }

  /**
   * Reload categories from ActivityWatch server
   * This is useful when categories may have been modified externally
   */
  async reloadCategories(): Promise<void> {
    logger.debug('Reloading categories from ActivityWatch server');
    await this.loadFromActivityWatch();
  }

  /**
   * Check if categories are configured
   */
  hasCategories(): boolean {
    return this.categories.length > 0;
  }

  /**
   * Categorize a single event
   * Returns the most specific (deepest) matching category
   * Handles window events (app/title), web events (url), and editor events (editor/project/file/language)
   */
  categorizeEvent(event: AWEvent): string | null {
    if (this.categories.length === 0) {
      return null;
    }

    // Extract fields from different event types
    const app = getStringProperty(event.data, 'app');
    const title = getStringProperty(event.data, 'title');
    const url = getStringProperty(event.data, 'url');
    const editor = getStringProperty(event.data, 'editor');
    const project = getStringProperty(event.data, 'project');
    const file = getStringProperty(event.data, 'file');
    const language = getStringProperty(event.data, 'language');

    // Combine all fields for matching
    const searchText = `${app} ${title} ${url} ${editor} ${project} ${file} ${language}`.toLowerCase();

    let bestMatch: Category | null = null;
    let bestMatchDepth = -1;

    for (const category of this.categories) {
      if (category.rule.type === 'none') {
        continue;
      }

      if (category.rule.type === 'regex' && category.rule.regex) {
        try {
          const regex = new RegExp(category.rule.regex, 'i'); // Case-insensitive
          
          if (regex.test(searchText)) {
            // Prefer deeper categories (more specific)
            const depth = category.name.length;
            if (depth > bestMatchDepth) {
              bestMatch = category;
              bestMatchDepth = depth;
            }
          }
        } catch (error) {
          logger.warn(`Invalid regex in category ${category.name.join(' > ')}`, error);
        }
      }
    }

    return bestMatch ? bestMatch.name.join(' > ') : null;
  }

  /**
   * Categorize multiple events and return usage statistics
   */
  categorizeEvents(events: AWEvent[]): CategoryUsage[] {
    if (this.categories.length === 0) {
      logger.warn('No categories configured');
      return [];
    }

    // Map to track category usage
    const categoryMap = new Map<string, { duration: number; count: number }>();

    // Track uncategorized time
    let uncategorizedDuration = 0;
    let uncategorizedCount = 0;

    for (const event of events) {
      const category = this.categorizeEvent(event);
      
      if (category) {
        const existing = categoryMap.get(category) || { duration: 0, count: 0 };
        categoryMap.set(category, {
          duration: existing.duration + event.duration,
          count: existing.count + 1,
        });
      } else {
        uncategorizedDuration += event.duration;
        uncategorizedCount += 1;
      }
    }

    // Add uncategorized if there is any
    if (uncategorizedDuration > 0) {
      categoryMap.set('Uncategorized', {
        duration: uncategorizedDuration,
        count: uncategorizedCount,
      });
    }

    // Calculate total duration for percentages
    const totalDuration = Array.from(categoryMap.values())
      .reduce((sum, cat) => sum + cat.duration, 0);

    // Convert to CategoryUsage array
    const usage: CategoryUsage[] = [];
    for (const [name, stats] of categoryMap.entries()) {
      usage.push({
        category_name: name,
        duration_seconds: stats.duration,
        duration_hours: Math.round(stats.duration / 36) / 100, // Round to 2 decimals
        percentage: totalDuration > 0 
          ? Math.round((stats.duration / totalDuration) * 10000) / 100 
          : 0,
        event_count: stats.count,
      });
    }

    // Sort by duration (descending)
    return usage.sort((a, b) => b.duration_seconds - a.duration_seconds);
  }

  /**
   * Load categories from a JSON structure
   * This can be used to load categories from a file or API
   */
  loadCategoriesFromJSON(json: unknown): void {
    if (!Array.isArray(json)) {
      throw new Error('Categories must be an array');
    }

    const categories: Category[] = [];
    let idCounter = 0;

    const processCategory = (
      cat: any,
      parentName: string[] = []
    ): void => {
      const name = [...parentName, cat.name || 'Unnamed'];
      
      const rule: CategoryRule = cat.rule?.type === 'regex'
        ? { type: 'regex', regex: cat.rule.regex }
        : { type: 'none' };

      categories.push({
        id: idCounter++,
        name,
        rule,
      });

      // Process children recursively
      if (Array.isArray(cat.children)) {
        for (const child of cat.children) {
          processCategory(child, name);
        }
      }
    };

    for (const cat of json) {
      processCategory(cat);
    }

    this.setCategories(categories);
  }

  /**
   * Add a new category
   */
  async addCategory(
    name: string[],
    rule: CategoryRule,
    data?: CategoryData
  ): Promise<Category> {
    // Find the next available ID
    const maxId = this.categories.reduce((max, cat) => Math.max(max, cat.id), 0);
    const newCategory: Category = {
      id: maxId + 1,
      name,
      rule,
      ...(data && { data }),
    };

    this.categories.push(newCategory);
    await this.saveToActivityWatch();
    logger.info(`Added category: ${name.join(' > ')}`);
    return newCategory;
  }

  /**
   * Update an existing category
   */
  async updateCategory(id: number, updates: Partial<Omit<Category, 'id'>>): Promise<Category> {
    const index = this.categories.findIndex((cat) => cat.id === id);
    if (index === -1) {
      throw new Error(`Category with id ${id} not found`);
    }

    const updatedCategory: Category = {
      ...this.categories[index],
      ...updates,
      id, // Ensure ID doesn't change
    };

    this.categories[index] = updatedCategory;
    await this.saveToActivityWatch();
    logger.info(`Updated category ${id}: ${updatedCategory.name.join(' > ')}`);
    return updatedCategory;
  }

  /**
   * Delete a category by ID
   */
  async deleteCategory(id: number): Promise<void> {
    const index = this.categories.findIndex((cat) => cat.id === id);
    if (index === -1) {
      throw new Error(`Category with id ${id} not found`);
    }

    const category = this.categories[index];
    this.categories.splice(index, 1);
    await this.saveToActivityWatch();
    logger.info(`Deleted category ${id}: ${category.name.join(' > ')}`);
  }

  /**
   * Get a category by ID
   */
  getCategoryById(id: number): Category | undefined {
    return this.categories.find((cat) => cat.id === id);
  }

  /**
   * Example category structure for documentation
   */
  static getExampleCategories(): unknown {
    return [
      {
        name: 'Work',
        rule: { type: 'none' },
        children: [
          {
            name: 'Email',
            rule: { type: 'regex', regex: 'Gmail|Thunderbird|Outlook' },
          },
          {
            name: 'Coding',
            rule: { type: 'regex', regex: 'VSCode|IntelliJ|Sublime|vim|emacs' },
          },
          {
            name: 'Meetings',
            rule: { type: 'regex', regex: 'Zoom|Teams|Meet|Slack' },
          },
        ],
      },
      {
        name: 'Entertainment',
        rule: { type: 'none' },
        children: [
          {
            name: 'Gaming',
            rule: { type: 'regex', regex: 'Steam|minecraft|game' },
          },
          {
            name: 'Video',
            rule: { type: 'regex', regex: 'YouTube|Netflix|Twitch' },
          },
          {
            name: 'Social Media',
            rule: { type: 'regex', regex: 'Twitter|Facebook|Reddit|Instagram' },
          },
        ],
      },
      {
        name: 'Communication',
        rule: { type: 'regex', regex: 'Slack|Discord|Telegram|WhatsApp' },
      },
    ];
  }
}

