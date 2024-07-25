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
import { CollectionBreadcrumb } from '@vendure/common/lib/generated-types';
import { getProductPrimaryCollectionIDInChannel } from '../util/helpers';

interface ProductBreadcrumb {
  name: string;
  id: ID;
  slug: string;
}

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
  async productBreadcrumb(
    @Ctx() ctx: RequestContext,
    @Parent() product: Product
  ): Promise<ProductBreadcrumb[]> {
    const primaryCollection = await this.primaryCollection(ctx, product);
    const productBreadcrumb = {
      id: product.id,
      name: product.name,
      slug: product.slug,
    };
    if (!primaryCollection) {
      // No parent collection, so return only the product breadcrumb
      return [productBreadcrumb];
    } else {
      // eslint-disable-next-line -- See https://github.com/vendure-ecommerce/vendure/pull/2960
      const parentCollectionbreadcrumb =
        (await this.collectionService.getBreadcrumbs(
          ctx,
          primaryCollection
        )) as CollectionBreadcrumb[];
      // Append product breadcrumb to it's parent breadcrumbs, so that we get Product > Parent Collection > Root Collection
      return [...parentCollectionbreadcrumb, productBreadcrumb];
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
