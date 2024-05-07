import { ID, Injector, RequestContext } from '@vendure/core';
import { In } from 'typeorm';
import { assignTheseProductsToChannel } from './assign-these-prodcuts-to-channel';
import { getProductsDeep } from './get-products-deep';

export async function assignProductsToChannel(
  targetChannelId: ID,
  injector: Injector,
  productIds: ID[],
  ctx: RequestContext
): Promise<void> {
  // get all products of the source channel with id productIds
  const products = await getProductsDeep(ctx, injector, { id: In(productIds) });
  await assignTheseProductsToChannel(targetChannelId, injector, products, ctx);
}
