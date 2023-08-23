import {
  Injector,
  Logger,
  Order,
  ProductVariant,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import {
  AdvancedMetricSummaryInput,
  AdvancedMetricType,
} from '../../ui/generated/graphql';
import { MetricStrategy, NamedDatapoint } from '../metric-strategy';

const loggerCtx = 'AverageOrderValueMetric';
/**
 * Calculates the average order value per month
 */
export class AverageOrderValueMetric implements MetricStrategy<Order> {
  readonly metricType: AdvancedMetricType = AdvancedMetricType.Currency;
  readonly code = 'aov';

  getTitle(ctx: RequestContext): string {
    return `Average order value in ${ctx.channel.defaultCurrencyCode}`;
  }

  getSortableField(entity: Order): Date {
    return entity.orderPlacedAt ?? entity.updatedAt;
  }

  async loadEntities(
    ctx: RequestContext,
    injector: Injector,
    from: Date,
    to: Date,
    variants: ProductVariant[]
  ): Promise<Order[]> {
    let skip = 0;
    const take = 1000;
    let hasMoreOrders = true;
    const orders: Order[] = [];
    while (hasMoreOrders) {
      let query = injector
        .get(TransactionalConnection)
        .getRepository(ctx, Order)
        .createQueryBuilder('order')
        .leftJoin('order.channels', 'orderChannel')
        .leftJoin('order.lines', 'orderLine')
        .leftJoin('orderLine.productVariant', 'productVariant')
        .where(`orderChannel.id=:channelId`, { channelId: ctx.channelId })
        .andWhere(`order.orderPlacedAt >= :from`, {
          from: from.toISOString(),
        })
        .andWhere(`order.orderPlacedAt <= :to`, {
          to: to.toISOString(),
        })
        .skip(skip)
        .take(take);

      if (variants.length) {
        query = query.andWhere(`productVariant.id IN(:...variantIds)`, {
          variantIds: variants.map((v) => v.id),
        });
      }
      const [items, totalOrders] = await query.getManyAndCount();
      orders.push(...items);
      Logger.info(
        `Fetched orders ${skip}-${skip + take} for channel ${
          ctx.channel.token
        }`,
        loggerCtx
      );
      skip += items.length;
      if (orders.length >= totalOrders) {
        hasMoreOrders = false;
      }
    }
    return orders;
  }

  calculateDataPoints(
    ctx: RequestContext,
    entities: Order[],
    variants: ProductVariant[]
  ): NamedDatapoint[] {
    const legendLabel = variants.length
      ? `Average order value containing variants ${variants
          .map((v) => v.sku)
          .join(', ')}`
      : 'Average order value';
    if (!entities.length) {
      // Return 0 as average if no orders
      return [
        {
          legendLabel,
          value: 0,
        },
      ];
    }
    const total = entities
      .map((o) => o.totalWithTax)
      .reduce((total, current) => total + current, 0);
    const average = Math.round(total / entities.length) / 100;
    return [
      {
        legendLabel,
        value: average,
      },
    ];
  }
}
