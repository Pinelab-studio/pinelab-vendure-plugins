import {
  AssetService,
  ChannelService,
  FacetService,
  ID,
  Injector,
  Product,
  ProductVariantService,
  RequestContext,
  SearchService,
} from '@vendure/core';
import { getSuperadminContextInChannel } from '../../../util/src/superadmin-request-context';

/**
 * This function should be used with batches of Products
 */
export async function assignTheseProductsToChannel(
  targetChannelId: ID,
  injector: Injector,
  products: Product[],
  ctx: RequestContext
): Promise<void> {
  // assign them to target channel
  const productVariantService = injector.get(ProductVariantService);
  const assetService = injector.get(AssetService);
  const facetService = injector.get(FacetService);
  const channelService = injector.get(ChannelService);
  const searchService = injector.get(SearchService);
  const facetIds = products
    .map((product) =>
      (product.facetValues ?? []).map((facetValue) => facetValue.facet.id)
    )
    .flat();
  const assetIds = products
    .map((product) => (product.assets ?? []).map((asset) => asset.id))
    .flat();
  const variantIds = products
    .map((product) => (product.variants ?? []).map((variant) => variant.id))
    .flat();
  const targetChannel = await channelService.findOne(ctx, targetChannelId);
  const superadminContextInTargetChannel = await getSuperadminContextInChannel(
    injector,
    targetChannel!
  );
  await Promise.all([
    //we will first assign the product variants, which will also assign the associated products and variants' assets
    productVariantService.assignProductVariantsToChannel(ctx, {
      channelId: targetChannelId,
      productVariantIds: variantIds,
    }),
    //we will then assign the product assets to the target channels
    assetService.assignToChannel(ctx, { assetIds, channelId: targetChannelId }),
    //we will then assign the facets with the associated values
    facetService.assignFacetsToChannel(ctx, {
      channelId: targetChannelId,
      facetIds,
    }),
    searchService.reindex(superadminContextInTargetChannel),
  ]);
}
