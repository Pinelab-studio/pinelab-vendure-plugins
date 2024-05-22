import {
  ID,
  Injector,
  Product,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { In } from 'typeorm';
import { assignTheseProductsToChannel } from './assign-these-products-to-channel';
import { getProductsDeep } from './get-products-deep';

export async function assignProductsToChannel(
  targetChannelId: ID,
  injector: Injector,
  productIds: ID[],
  ctx: RequestContext,
  batch: number = 10
): Promise<void> {
  let totalCount = 0;
  let products: Product[];
  const conn = injector.get(TransactionalConnection);
  await conn.startTransaction(ctx);
  do {
    // get products of the source channel with id productIds
    products = await getProductsDeep(
      ctx,
      injector,
      { id: In(productIds) },
      batch,
      totalCount
    );
    totalCount += products.length;
    await assignTheseProductsToChannel(
      targetChannelId,
      injector,
      products,
      ctx
    );
  } while (products.length);
  await conn.commitOpenTransaction(ctx);
}
