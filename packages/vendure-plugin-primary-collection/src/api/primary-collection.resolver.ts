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
} from '@vendure/core';
import { getProductPrimaryCollectionIDInChannel } from '../util';

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
      (product.customFields as any).primaryCollection
    );
    if (collectionId) {
      return this.collectionService.findOne(ctx, collectionId);
    }
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
