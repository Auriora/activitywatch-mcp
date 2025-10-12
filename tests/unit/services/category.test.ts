import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { CategoryService } from '../../../src/services/category.js';

const makeEvent = (duration: number, data: Record<string, any>) => ({
  timestamp: '2025-01-01T10:00:00.000Z',
  duration,
  data,
});

describe('CategoryService helper methods', () => {
  let service: CategoryService;
  let client: { getSettings: ReturnType<typeof vi.fn>; updateSettings: ReturnType<typeof vi.fn> };
  const originalEnv = process.env.AW_CATEGORIES;

  beforeEach(() => {
    client = {
      getSettings: vi.fn().mockResolvedValue({ classes: [] }),
      updateSettings: vi.fn().mockResolvedValue(undefined),
    };
    service = new CategoryService(client as any);
  });

  afterEach(() => {
    process.env.AW_CATEGORIES = originalEnv;
    vi.restoreAllMocks();
  });

  it('loads categories from JSON structures', () => {
    const example = CategoryService.getExampleCategories();
    service.loadCategoriesFromJSON(example);

    const categories = service.getCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0]?.name[0]).toBeDefined();
  });

  it('categorizes events using the most specific matching rule', () => {
    service.setCategories([
      { id: 1, name: ['Work'], rule: { type: 'regex', regex: 'work' } },
      { id: 2, name: ['Work', 'Coding'], rule: { type: 'regex', regex: 'code' } },
    ]);

    const match = service.categorizeEvent(makeEvent(120, { title: 'Code Review' } as any));
    expect(match).toBe('Work > Coding');
  });

  it('aggregates category usage and tracks uncategorized time', () => {
    service.setCategories([
      { id: 1, name: ['Work', 'Coding'], rule: { type: 'regex', regex: 'code' } },
    ]);

    const usage = service.categorizeEvents([
      makeEvent(120, { title: 'Code Review' }),
      makeEvent(60, { title: 'Music Break' }),
    ]);

    const coding = usage.find(item => item.category_name === 'Work > Coding');
    const uncategorized = usage.find(item => item.category_name === 'Uncategorized');

    expect(coding?.duration_seconds).toBe(120);
    expect(coding?.percentage).toBeCloseTo(66.67, 2);
    expect(uncategorized?.duration_seconds).toBe(60);
  });

  it('loads categories from ActivityWatch settings', async () => {
    const classes = [{ id: 1, name: ['Work'], rule: { type: 'none' } }];
    client.getSettings.mockResolvedValue({ classes });

    await service.loadFromActivityWatch();

    expect(client.getSettings).toHaveBeenCalled();
    expect(service.getCategories()).toEqual(classes);
  });

  it('falls back to AW_CATEGORIES environment variable', async () => {
    client.getSettings.mockRejectedValue(new Error('Unavailable'));
    process.env.AW_CATEGORIES = JSON.stringify([
      { name: 'Focus', rule: { type: 'regex', regex: 'focus' } },
    ]);

    await service.loadFromActivityWatch();
    expect(service.getCategories().length).toBe(1);
  });

  it('adds, updates, and deletes categories via ActivityWatch client', async () => {
    service.setCategories([{ id: 1, name: ['Work'], rule: { type: 'none' } }]);

    const created = await service.addCategory(['Leisure'], { type: 'regex', regex: 'game' });
    expect(created.id).toBe(2);
    expect(client.updateSettings).toHaveBeenCalledWith('classes', service.getCategories());

    const updated = await service.updateCategory(created.id, { name: ['Leisure', 'Gaming'] });
    expect(updated.name).toEqual(['Leisure', 'Gaming']);

    await service.deleteCategory(updated.id);
    expect(service.getCategories().find(cat => cat.id === updated.id)).toBeUndefined();
  });

  it('throws when updating or deleting missing categories', async () => {
    await expect(service.updateCategory(99, { name: ['Missing'] })).rejects.toThrow('Category with id 99 not found');
    await expect(service.deleteCategory(42)).rejects.toThrow('Category with id 42 not found');
  });
});
