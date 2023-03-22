import { Injectable } from '@nestjs/common';
import {
  Collection,
  CollectionService,
  OrderLine,
  Product,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { Success } from '../../test/src/generated/admin-graphql';
import { CollectionTreeNode } from './helpers';
@Injectable()
export class SortService {
  constructor(
    private connection: TransactionalConnection,
    private collectionService: CollectionService
  ) {}
  async setProductPopularity(ctx: RequestContext): Promise<Success> {
    const groupedOrderLines = await this.connection
      .getRepository(ctx, OrderLine)
      .createQueryBuilder('orderLine')
      .select([
        'count(product.id) as count',
        'orderLine.productVariant',
        'orderLine.order',
      ])
      .innerJoin('orderLine.productVariant', 'productVariant')
      .addSelect([
        'productVariant.deletedAt',
        'productVariant.enabled',
        'productVariant.id',
      ])
      .innerJoin('orderLine.order', '`order`')
      .innerJoin('productVariant.product', 'product')
      .addSelect(['product.deletedAt', 'product.enabled', 'product.id'])
      .innerJoin('productVariant.collections', 'collection')
      .addSelect(['collection.id'])
      .innerJoin('`order`.channels', 'order_channel')
      .andWhere('`order`.orderPlacedAt is NOT NULL')
      .andWhere('product.deletedAt IS NULL')
      .andWhere('productVariant.deletedAt IS NULL')
      .andWhere('product.enabled')
      .andWhere('productVariant.enabled')
      .andWhere(`order_channel.id=${ctx.channelId}`)
      .addGroupBy('product.id')
      .addOrderBy('count', 'DESC')
      .getRawMany();
    const maxCount = groupedOrderLines[0].count;
    const maxValue = 1000;
    const productRepositoty =
      this.connection.rawConnection.getRepository(Product);
    const collectionRepositoty =
      this.connection.rawConnection.getRepository(Collection);
    const uniqueCollectioIds: string[] = [];
    const collectionScoreValues: number[] = [];
    for (const groupLines of groupedOrderLines) {
      const score = (groupLines.count * maxValue) / maxCount;
      await productRepositoty.update(groupLines.product_id, {
        customFields: {
          popularityScore: score,
        },
      });
      const collectionIndex = uniqueCollectioIds.findIndex(
        (s) => s == groupLines.collection_id
      );
      if (collectionIndex != -1) {
        uniqueCollectioIds.push(groupLines.collection_id);
        collectionScoreValues.push(score);
      } else {
        collectionScoreValues[collectionIndex] =
          collectionScoreValues[collectionIndex] + score;
      }
    }

    for (const collectionIdIndex in uniqueCollectioIds) {
      await collectionRepositoty.update(uniqueCollectioIds[collectionIdIndex], {
        customFields: {
          popularityScore: collectionScoreValues[collectionIdIndex],
        },
      });
    }
    return { success: true };
  }

  async assignPopularityToCollections(ctx: RequestContext): Promise<Success> {
    return { success: true };
  }
}
