import { ProductVariant, RequestContext } from '@vendure/core';
import { BetterSearchResult, SearchEngine } from '../../src';

type DummySearchIndex = {
  id: string;
  name: string;
};

export class DummyEngine implements SearchEngine {
  async createIndex(ctx: RequestContext, documents: ProductVariant[]) {
    return {
      id: '1',
      name: 'Product 1',
    };
  }

  async search(
    ctx: RequestContext,
    searchIndex: DummySearchIndex,
    term: string
  ) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return Promise.resolve([]);
  }
}
