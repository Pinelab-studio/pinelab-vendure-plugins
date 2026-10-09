import { RequestContext, VendureEvent } from '@vendure/core';

export type BetterSearchIndexType = 'full' | 'partial';

export class BetterSearchIndexEvent extends VendureEvent {
  constructor(
    public readonly ctx: RequestContext,
    public readonly numberOfProductsIndexed: number,
    public readonly type: BetterSearchIndexType
  ) {
    super();
  }
}
