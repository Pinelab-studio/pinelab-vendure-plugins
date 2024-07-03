import { Injectable } from '@nestjs/common';
import {
  Channel,
  Product,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import {
  ProductPrimaryCollection,
  parseProductPrimaryCollectionCustomField,
} from '../util';

@Injectable()
export class PrimaryCollectionHelperService {
  constructor(private conn: TransactionalConnection) {}

  async setPrimaryCollectionForAllProducts(ctx: RequestContext) {
    const productsRepository = this.conn.getRepository(ctx, Product);
    const allProducts = await productsRepository
      .createQueryBuilder('product')
      .leftJoin('product.variants', 'variant')
      .leftJoin('variant.collections', 'collection')
      .leftJoin('collection.channels', 'collectionChannel')
      .leftJoin('product.channels', 'productChannel')
      .select([
        'product.id',
        'productChannel.id',
        'collection.id',
        'variant.id',
        'collectionChannel.id',
      ])
      .where('not collection.isPrivate')
      .getMany();
    const updatedProducts: Partial<Product>[] = [];
    for (const product of allProducts) {
      const primaryCollections = parseProductPrimaryCollectionCustomField(
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
        (product.customFields as any)?.primaryCollection
      );
      const updatedPrimaryCollectionList: ProductPrimaryCollection[] = [];

      for (const channel of product.channels) {
        const primaryCollection = this.getVariantCollectionInChannel(
          product,
          channel
        );
        if (!primaryCollection) {
          continue;
        }
        const primaryCollectionDetailInChannel = primaryCollections.find(
          (primaryCollection) => primaryCollection.channelId === channel.id
        );
        if (primaryCollectionDetailInChannel) {
          updatedPrimaryCollectionList.push(primaryCollectionDetailInChannel);
          continue;
        }
        updatedPrimaryCollectionList.push({
          channelId: channel.id,
          collectionId: primaryCollection?.id,
        });
      }
      updatedProducts.push({
        id: product.id,
        customFields: {
          primaryCollection: updatedPrimaryCollectionList.map(
            (primaryCollection) => JSON.stringify(primaryCollection)
          ),
        },
      });
    }
    await productsRepository.save(updatedProducts);
  }

  getVariantCollectionInChannel(product: Product, channel: Channel) {
    for (const variant of product.variants) {
      for (const collection of variant.collections) {
        if (
          !!collection.channels.find(
            (collectionChannel) => collectionChannel.id === channel.id
          ) &&
          !collection.isPrivate
        ) {
          return collection;
        }
      }
    }
  }
}
