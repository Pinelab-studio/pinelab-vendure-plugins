import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import {
  Collection,
  CollectionService,
  Ctx,
  RequestContext,
  Product,
} from '@vendure/core';

@Resolver('Product')
export class PrimaryCollectionResolver {
  constructor(private readonly collectionService: CollectionService) {}

  @ResolveField()
  async primaryCollection(
    @Ctx() ctx: RequestContext,
    @Parent() product: Product
  ): Promise<Collection | null> {
    const collections = await this.collectionService.getCollectionsByProductId(
      ctx,
      product.id,
      true
    );
    const collectionsExcludingParents = collections.filter(
      (coll) => !collections.find((childColl) => childColl.parentId === coll.id)
    );
    return collectionsExcludingParents.reduce<Collection | null>((acc, val) => {
      if (!acc) {
        return val;
      }
      if (val.position < acc.position) {
        return val;
      }
      return acc;
    }, null);
  }
}
