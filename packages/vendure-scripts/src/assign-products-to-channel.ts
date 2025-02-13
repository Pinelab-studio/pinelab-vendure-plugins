import {
  AssetService,
  ChannelService,
  ID,
  Injector,
  Product,
  ProductService,
  ProductVariantService,
  RequestContext,
  SearchService,
  TransactionalConnection,
} from '@vendure/core';
import { FindOptionsWhere, IsNull } from 'typeorm';
import { getSuperadminContextInChannel } from '../../util/src/superadmin-request-context';

export async function assignAllProductsToChannel(
  sourceChannelId: ID,
  targetChannelId: ID,
  injector: Injector,
  ctx: RequestContext,
  batch: number = 10
): Promise<void> {
  await assignProductsInBatch(
    targetChannelId,
    sourceChannelId,
    injector,
    ctx,
    batch
  );
}

async function assignProductsInBatch(
  targetChannelId: ID,
  sourceChannelId: ID,
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
    products = await getProductsWithRelations(
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
    await assignProductsToChannel(targetChannelId, injector, products, ctx);
  } while (products.length);
  await searchService.reindex(ctxInTargetChannel);
  await conn.commitOpenTransaction(ctx);
}

/**
 * This function should be used with batches of Products
 */
export async function assignProductsToChannel(
  targetChannelId: ID,
  injector: Injector,
  products: Product[],
  ctx: RequestContext
): Promise<void> {
  // Assign all assets to target channel
  const assetService = injector.get(AssetService);
  const productAssetIds = products
    .map((product) => (product.assets ?? []).map((asset) => asset.id))
    .flat();
  const variantAssetIds = products
    .map((p) => p.variants.map((v) => (v.assets ?? []).map((a) => a.id)).flat())
    .flat();
  const assetIds = [...productAssetIds, ...variantAssetIds];
  await assetService.assignToChannel(ctx, {
    assetIds,
    channelId: targetChannelId,
  });
  // Assign all variants to channel
  const productVariantService = injector.get(ProductVariantService);
  const variantIds = products
    .map((product) => (product.variants ?? []).map((variant) => variant.id))
    .flat();
  await productVariantService.assignProductVariantsToChannel(ctx, {
    channelId: targetChannelId,
    productVariantIds: variantIds,
  });
  // Assign products to channel
  await injector.get(ProductService).assignProductsToChannel(ctx, {
    channelId: targetChannelId,
    productIds: products.map((product) => product.id),
  });
}

async function getProductsWithRelations(
  ctx: RequestContext,
  injector: Injector,
  condition:
    | FindOptionsWhere<Product>
    | FindOptionsWhere<Product>[]
    | undefined,
  take: number = 10,
  skip: number = 0
) {
  const conn = injector.get(TransactionalConnection);
  const productRepo = conn.getRepository(ctx, Product);
  // using TransactionalConnection is an anti pattern, but it is the only way to ensure that only the ids are fetched
  return productRepo
    .createQueryBuilder('product')
    .select('product.id')
    .addSelect('channel.id')
    .addSelect('facet.id')
    .addSelect('asset.id')
    .addSelect('variant.id')
    .innerJoin('product.channels', 'channel')
    .innerJoin('product.variants', 'variant')
    .leftJoin('product.facetValues', 'facetValue')
    .leftJoin('facetValue.facet', 'facet')
    .leftJoin('product.assets', 'asset')
    .setFindOptions({ where: condition, take, skip })
    .getMany();
}
