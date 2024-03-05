import {
  ID,
  Injector,
  Product,
  ProductService,
  RequestContext,
  TransactionalConnection,
  Translated,
} from '@vendure/core';

export async function assignAllProductsToChannel(
  sourceChannelId: ID,
  targetChannelId: ID,
  injector: Injector,
  ctx: RequestContext
): Promise<Array<Translated<Product>>> {
  // get all products of the source channel
  const conn = injector.get(TransactionalConnection);
  const productRepo = conn.getRepository(ctx, Product);
  // using TransactionalConnection is an anti pattern, but it is the only way to ensure that only the ids are fetched
  const sourceChannelProductIds: Array<{ product_id: string }> =
    await productRepo
      .createQueryBuilder('product')
      .select('product.id')
      .innerJoin('product.channels', 'channel')
      .setFindOptions({ where: { channels: { id: sourceChannelId } } })
      .getRawMany();
  // assign them to target channel
  const productService = injector.get(ProductService);
  return await productService.assignProductsToChannel(ctx, {
    channelId: targetChannelId,
    productIds: sourceChannelProductIds.map(
      (productFragment) => productFragment.product_id
    ),
  });
}
