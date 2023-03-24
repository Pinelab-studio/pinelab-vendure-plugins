import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ChannelService,
  Collection,
  CollectionService,
  JobQueue,
  JobQueueService,
  OrderItem,
  OrderLine,
  Product,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { Success } from '../../test/src/generated/admin-graphql';
import { CollectionTreeNode } from './helpers';
@Injectable()
export class SortService implements OnModuleInit {
  private jobQueue: JobQueue<{ channelToken: string }>;
  constructor(
    private connection: TransactionalConnection,
    private jobQueueService: JobQueueService,
    private channelService: ChannelService
  ) {}
  async onModuleInit() {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'calculate-scores',
      process: async (job) => {
        const channel = await this.channelService.getChannelFromToken(
          job.data.channelToken
        );
        const ctx = new RequestContext({
          apiType: 'admin',
          isAuthorized: true,
          authorizedAsOwnerOnly: false,
          channel,
        });
        this.setProductPopularity(ctx);
      },
    });
  }

  async setProductPopularity(ctx: RequestContext): Promise<Success> {
    const groupedOrderItems = await this.connection
      .getRepository(ctx, OrderItem)
      .createQueryBuilder('orderItem')
      .innerJoin('orderItem.line', 'orderLine')
      .select([
        'count(product.id) as count',
        'orderItem.line',
        'orderLine.productVariant',
        'orderLine.order',
      ])
      .innerJoin('orderLine.productVariant', 'productVariant')
      .addSelect([
        'productVariant.deletedAt',
        'productVariant.enabled',
        'productVariant.id',
      ])
      .innerJoin('orderLine.order', 'order')
      .innerJoin('productVariant.product', 'product')
      .addSelect(['product.deletedAt', 'product.enabled', 'product.id'])
      .innerJoin('productVariant.collections', 'collection')
      .addSelect(['collection.id'])
      .innerJoin('order.channels', 'order_channel')
      .andWhere('order.orderPlacedAt is NOT NULL')
      .andWhere('product.deletedAt IS NULL')
      .andWhere('productVariant.deletedAt IS NULL')
      .andWhere('product.enabled')
      .andWhere('productVariant.enabled')
      .andWhere('order_channel.id = :id', { id: ctx.channelId })
      .addGroupBy('product.id')
      .addOrderBy('count', 'DESC')
      .getRawMany();
    const maxCount = groupedOrderItems[0].count;
    const maxValue = 1000;
    const productRepository = this.connection.getRepository(ctx, Product);
    await productRepository.save(
      groupedOrderItems.map((gols) => {
        return {
          id: gols.product_id,
          customFields: {
            popularityScore: Math.round((gols.count / maxCount) * maxValue),
          },
        };
      })
    );
    await this.assignScoreValuesToCollections(ctx);
    return { success: true };
  }

  async assignScoreValuesToCollections(ctx: RequestContext) {
    // const allCollections = await this.getAllCollections(ctx);
    // console.log(allCollections);
    // this.convertIntoTreeNodesAndAssignKnownValues(allCollections);
    this.differentApproach(ctx);
  }

  async getAllCollections(ctx: RequestContext): Promise<Collection[]> {
    const collectionsRepo =
      this.connection.rawConnection.getRepository(Collection);
    return await collectionsRepo
      .createQueryBuilder('collection')
      .leftJoin('collection.productVariants', 'productVariant')
      .addSelect(['productVariant.product'])
      // .leftJoin('productVariant.product','product')
      .leftJoin(
        (qb) =>
          qb
            .select(['customFieldsPopularityscore', 'id'])
            .from(Product, 'p')
            .groupBy('p.id'),
        'uniqueProduct',
        'uniqueProduct.id = productVariant.productId'
      )
      // .addSelect(['count(distinct product.id) as uniqueProductCount'])
      .addSelect(['SUM(uniqueProduct.customFieldsPopularityscore) as score'])
      .addGroupBy('collection.id')
      .orderBy('collection.isRoot', 'DESC')
      .addOrderBy('collection.parentId', 'DESC')
      .addOrderBy('collection.position', 'ASC')
      .getRawMany();
  }

  async differentApproach(ctx: RequestContext) {
    const productRepository = this.connection.getRepository(ctx, Product);
    const mergedOrderLines = await productRepository
      .createQueryBuilder('product')
      .leftJoin('product.variants', 'variant')
      .addSelect(['variant.id'])
      .leftJoin('variant.collections', 'collection')
      .addSelect(['SUM(product.customFieldsPopularityscore) as count'])
      .groupBy('collection.id')
      .getRawMany();
    console.log(mergedOrderLines);
  }

  convertIntoTreeNodesAndAssignKnownValues(input: any[]): CollectionTreeNode[] {
    const nodes: CollectionTreeNode[] = [];
    //since the first collection is gonna be the root collection, we should start by assigning it
    const rootNode = new CollectionTreeNode();
    rootNode.id = input[0].collection_id;
    nodes.push(rootNode);
    for (
      var collectionIndex = 1;
      collectionIndex < input.length;
      collectionIndex++
    ) {
      if (input[collectionIndex].parentId != nodes[nodes.length - 1].id) {
        //new node has come up
        const newNode = new CollectionTreeNode();
        newNode.id = input[collectionIndex].collection_id;
      } else {
        //update the child nodes of the existing node
        nodes[nodes.length - 1].children.push(input[collectionIndex]);
      }
    }
    console.log(nodes);
    return nodes;
  }

  addScoreCalculatingJobToQueue(channelToken: string) {
    return this.jobQueue.add({ channelToken }, { retries: 5 });
  }
}
