import { describe, it, expect, beforeEach } from 'vitest';

import { CategoryService } from '../../../src/services/category.js';
import { MockActivityWatchClient } from '../../helpers/mock-client.js';

describe('CategoryService helper methods', () => {
  let service: CategoryService;

  beforeEach(() => {
    const client = new MockActivityWatchClient();
    service = new CategoryService(client as any);
  });

  it('loads categories from JSON structures', () => {
    const example = CategoryService.getExampleCategories();
    service.loadCategoriesFromJSON(example);

    const categories = service.getCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0]?.name[0]).toBeDefined();
  });
});
