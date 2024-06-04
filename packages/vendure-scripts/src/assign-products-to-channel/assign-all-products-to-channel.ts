import {
  ID,
  Injector,
  Product,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { assignTheseProductsToChannel } from './assign-these-products-to-channel';
import { getProductsDeep } from './get-products-deep';
import { IsNull } from 'typeorm';

export async function assignAllProductsToChannel(
  sourceChannelId: ID,
  targetChannelId: ID,
  injector: Injector,
  ctx: RequestContext,
  batch: number = 10
): Promise<void> {
  let totalCount = 0;
  let products: Product[];
  const conn = injector.get(TransactionalConnection);
  await conn.startTransaction(ctx);
  do {
    // get all products of the source channel
    products = await getProductsDeep(
      ctx,
      injector,
      {
        channels: { id: sourceChannelId },
        deletedAt: IsNull(),
      },
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
  await conn.commitOpenTransaction(ctx);
}
