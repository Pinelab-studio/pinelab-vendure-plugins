import { ProductVariant, RequestContext } from '@vendure/core';
import { BetterSearchResult, SearchEngine } from '../../src';

export class DummyEngine implements SearchEngine<ProductVariant> {
  private index: any;

  async createIndex(
    ctx: RequestContext,
    documents: ProductVariant[]
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return Promise.resolve();
  }
  search(ctx: RequestContext, term: string): Promise<BetterSearchResult[]> {
    return Promise.resolve([]);
  }
}
