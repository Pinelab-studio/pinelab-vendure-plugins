import { idsAreEqual, ID, RequestContext } from '@vendure/core';

export type ProductPrimaryCollection = {
  channelId: ID;
  collectionId: ID;
};

export function parseProductPrimaryCollectionCustomField(
  primaryCollection: string[] | undefined
): ProductPrimaryCollection[] {
  return (primaryCollection ?? []).map(
    (primaryCollectionInChannel) =>
      JSON.parse(primaryCollectionInChannel) as ProductPrimaryCollection
  );
}

export function getProductPrimaryCollectionIDInChannel(
  ctx: RequestContext,
  primaryCollection: string[] | undefined
): ID | undefined {
  const productPriamryCollections =
    parseProductPrimaryCollectionCustomField(primaryCollection);
  return productPriamryCollections.find((primaryCollection) =>
    idsAreEqual(primaryCollection.channelId, ctx.channelId)
  )?.collectionId;
}
