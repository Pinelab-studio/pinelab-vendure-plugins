import {
  ChannelService,
  ID,
  Injector,
  Product,
  RequestContext,
  SearchService,
  TransactionalConnection,
} from '@vendure/core';
import { FindOptionsWhere } from 'typeorm';
import { getSuperadminContextInChannel } from '../../../util/src/superadmin-request-context';
import { assignTheseProductsToChannel } from './assign-these-products-to-channel';
import { getProductsDeep } from './get-products-deep';

export async function assignProductsInBatch(
  targetChannelId: ID,
  condition:
    | FindOptionsWhere<Product>
    | FindOptionsWhere<Product>[]
    | undefined,
  injector: Injector,
  ctx: RequestContext,
  batch: number = 10
): Promise<void> {
  let totalCount = 0;
  let products: Product[];
  const conn = injector.get(TransactionalConnection);
  const channelService = injector.get(ChannelService);

  const targetChannel = await channelService.findOne(ctx, targetChannelId);

  const ctxInTargetChannel = await getSuperadminContextInChannel(
    injector,
    targetChannel!
  );
  const searchService = injector.get(SearchService);
  await conn.startTransaction(ctx);
  do {
    // get all products of the source channel
    products = await getProductsDeep(
      ctx,
      injector,
      condition,
      batch,
      totalCount
    );
    totalCount += products.length;
    // assign them to target channel
    await assignTheseProductsToChannel(
      targetChannelId,
      injector,
      products,
      ctx
    );
  } while (products.length);
  await searchService.reindex(ctxInTargetChannel),
    await conn.commitOpenTransaction(ctx);
}
