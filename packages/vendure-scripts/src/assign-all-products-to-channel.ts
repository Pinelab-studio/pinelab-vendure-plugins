import { ID, Injector, RequestContext } from '@vendure/core';
import { assignTheseProductsToChannel } from './assign-these-prodcuts-to-channel';
import { getProductsDeep } from './get-products-deep';

export async function assignAllProductsToChannel(
  sourceChannelId: ID,
  targetChannelId: ID,
  injector: Injector,
  ctx: RequestContext
): Promise<void> {
  // get all products of the source channel
  const products = await getProductsDeep(ctx, injector, {
    channels: { id: sourceChannelId },
  });
  // assign them to target channel
  await assignTheseProductsToChannel(targetChannelId, injector, products, ctx);
}
