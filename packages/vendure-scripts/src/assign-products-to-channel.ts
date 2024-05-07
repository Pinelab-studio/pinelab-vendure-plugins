import { ID, Injector, Product, RequestContext } from '@vendure/core';
import { In } from 'typeorm';
import { assignTheseProductsToChannel } from './assign-these-prodcuts-to-channel';
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
}
