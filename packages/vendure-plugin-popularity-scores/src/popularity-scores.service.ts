import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import {
  ChannelService,
  Collection,
  CollectionService,
  ID,
  JobQueue,
  JobQueueService,
  Logger,
  OrderLine,
  Product,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from './constants';
import { PopularityScoresPluginConfig } from './popularity-scores.plugin';
import { sliceArray } from './utils';

declare module '@vendure/core/dist/entity/custom-entity-fields' {
  interface CustomCollectionFields {
    popularityScore: number;
  }
}
@Injectable()
export class PopularityScoresService implements OnModuleInit {
  private jobQueue!: JobQueue<{
    channelToken: string;
    ctx: SerializedRequestContext;
  }>;
  constructor(
    private connection: TransactionalConnection,
    private jobQueueService: JobQueueService,
    private channelService: ChannelService,
    private collectionService: CollectionService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: PopularityScoresPluginConfig
  ) {}
  async onModuleInit() {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'calculate-popularity-scores',
      process: async (job) => {
        await this.setProductPopularity(
          RequestContext.deserialize(job.data.ctx),
          job.data.channelToken
        ).catch((e) => {
          Logger.warn(
            `Failed to handle popularity calculation job: ${e?.message}`,
            loggerCtx
          );
          throw e;
        });
      },
    });
  }

  async setProductPopularity(
    ctx: RequestContext,
    channelToken: string
  ): Promise<void> {
    Logger.info(`Started calculating popularity scores`, loggerCtx);
    const channel = await this.channelService.getChannelFromToken(channelToken);
    const orderLineRepo = this.connection.getRepository(ctx, OrderLine);
    const ordersAfter = new Date();
    ordersAfter.setMonth(ordersAfter.getMonth() - 12);
    const groupedOrderLines = await orderLineRepo
      .createQueryBuilder('orderLine')
      .select(['SUM(orderLine.quantity) as count'])
      .innerJoin('orderLine.productVariant', 'productVariant')
      .innerJoin('orderLine.order', 'order')
      .innerJoin('productVariant.product', 'product')
      .addSelect(['product.id'])
      .innerJoin('order.channels', 'order_channel')
      .andWhere('order.orderPlacedAt > :ordersAfter', {
        ordersAfter: ordersAfter.toISOString(),
      })
      .andWhere('product.deletedAt IS NULL')
      .andWhere('productVariant.deletedAt IS NULL')
      .andWhere('product.enabled')
      .andWhere('productVariant.enabled')
      .andWhere('order_channel.id = :id', { id: channel.id })
      .addGroupBy('product.id')
      .addOrderBy('count', 'DESC')
      .getRawMany();
    const maxCount = groupedOrderLines?.[0]?.count;
    if (!maxCount) {
      Logger.warn(
        `No orders found for channel ${channel.code}, 
        not calculating popularity scores`,
        loggerCtx
      );
      return;
    }
    const maxValue = 1000;
    const productRepository = this.connection.getRepository(ctx, Product);
    await productRepository.save(
      groupedOrderLines.map((gols) => {
        return {
          id: gols.product_id,
          customFields: {
            popularityScore: Math.round((gols.count / maxCount) * maxValue),
          },
        };
      })
    );
    await this.assignScoreValuesToCollections(ctx);
    Logger.info(`Finished calculating popularity scores`, loggerCtx);
  }

  /**
   * This calculates the score of a collection based on its products and subcollections.
   * @param ctx
   */
  async assignScoreValuesToCollections(ctx: RequestContext) {
    const collectionsRepo = this.connection.getRepository(ctx, Collection);
    const collectionTreeRepo =
      this.connection.rawConnection.manager.getTreeRepository(Collection);
    const channelRootCollection = await collectionsRepo
      .createQueryBuilder('collection')
      .leftJoin('collection.channels', 'channel')
      .where('collection.isRoot = :isRoot', { isRoot: true })
      .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
      .getOne();
    if (!channelRootCollection) {
      Logger.warn('No root collection found for the channel', loggerCtx);
      return;
    }
    const channelCollectionsTree = await collectionTreeRepo.findDescendantsTree(
      channelRootCollection
    );
    const allCollections: Collection[] = [];
    const traverseDepthFirstAndUpdateScore = async (
      node: Collection
    ): Promise<number> => {
      node.customFields.popularityScore = 0;
      if (node?.children?.length) {
        for (const child of node.children) {
          node.customFields.popularityScore +=
            await traverseDepthFirstAndUpdateScore(child);
        }
      } else {
        node.customFields.popularityScore =
          await this.getSummedProductScoreCalculation(ctx, node);
      }
      allCollections.push(node);
      return node.customFields.popularityScore;
    };

    await traverseDepthFirstAndUpdateScore(channelCollectionsTree);
    for (const updateCollection of allCollections) {
      await collectionsRepo.update(
        { id: updateCollection.id },
        {
          customFields: {
            popularityScore: updateCollection.customFields.popularityScore,
          },
        }
      );
    }
  }

  private async getSummedProductScoreCalculation(
    ctx: RequestContext,
    collection: Collection
  ): Promise<number> {
    const collectionsRepo = this.connection.getRepository(ctx, Collection);
    const productsRepo = this.connection.getRepository(ctx, Product);
    const variantsPartialInfoResults = await collectionsRepo
      .createQueryBuilder('collection')
      .leftJoin('collection.productVariants', 'productVariant')
      .innerJoin('productVariant.product', 'product')
      .addSelect(['product.customFields.popularityScore', 'product.id'])
      .where('collection.id= :id', { id: collection.id.toString() })
      .getRawMany();

    const productIds = variantsPartialInfoResults
      .filter((i) => i.product_id != null)
      .map((i) => i.product_id);

    const uniqueProductIds = [...new Set(productIds)];
    if (uniqueProductIds.length) {
      let score = 0;
      const chunkedProductIds = sliceArray(
        uniqueProductIds,
        this.config.chunkSize ?? 100
      );
      for (let uniqueProductIdsSlice of chunkedProductIds) {
        const summedProductsValue = await productsRepo
          .createQueryBuilder('product')
          .select(
            'SUM(product.customFields.popularityScore) AS productScoreSum'
          )
          .andWhere('product.id IN (:...ids)', { ids: uniqueProductIdsSlice })
          .getRawOne();
        // Convert to number to ensure correct arithmetic operation
        score += Number(summedProductsValue.productScoreSum) ?? 0;
      }
      return score;
    }
    return 0;
  }

  addScoreCalculatingJobToQueue(channelToken: string, ctx: RequestContext) {
    return this.jobQueue.add(
      { channelToken, ctx: ctx.serialize() },
      { retries: 5 }
    );
  }
}
