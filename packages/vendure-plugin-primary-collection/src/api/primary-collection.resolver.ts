import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import {
  Collection,
  Ctx,
  RequestContext,
  Product,
  CollectionService,
  Translated,
  Channel,
  EntityHydrator,
  ID,
} from '@vendure/core';
import { getProductPrimaryCollectionIDInChannel } from '../util/helpers';

@Resolver()
export class PrimaryCollectionPluginResolver {
  constructor(
    private collectionService: CollectionService,
    private entityHydrator: EntityHydrator
  ) {}
  @ResolveField('primaryCollection')
  @Resolver('Product')
  async primaryCollection(
    @Ctx() ctx: RequestContext,
    @Parent() product: Product
  ): Promise<Translated<Collection> | undefined> {
    const collectionId = getProductPrimaryCollectionIDInChannel(
      ctx,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (product.customFields as any).primaryCollection as string
    );
    if (collectionId) {
      return this.collectionService.findOne(ctx, collectionId);
    }
  }

  @ResolveField('breadcrumbs')
  @Resolver('Product')
  productBreadcrumb(@Parent() product: Product): {
    name: string;
    id: ID;
    slug: string;
  } {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
    };
  }

  @ResolveField('channels')
  @Resolver('Collection')
  async channels(
    @Ctx() ctx: RequestContext,
    @Parent() collection: Collection
  ): Promise<Channel[] | undefined> {
    await this.entityHydrator.hydrate(ctx, collection, {
      relations: ['channels'],
    });
    return collection.channels;
  }
}
