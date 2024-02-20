import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Collection, Ctx, RequestContext, Product } from '@vendure/core';

@Resolver('Product')
export class PrimaryCollectionResolver {
  @ResolveField()
  async primaryCollection(
    @Ctx() ctx: RequestContext,
    @Parent() product: Product,
  ): Promise<Collection | null> {
    return (product.customFields as any).primaryCollection;
  }
}
