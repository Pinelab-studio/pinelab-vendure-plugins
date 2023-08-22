import {
  Injector,
  Logger,
  Order,
  RequestContext,
  Transaction,
  TransactionalConnection,
} from '@vendure/core';
import { loggerCtx } from '../../constants';
import {
  AdvancedMetricSummaryInput,
  AdvancedMetricType,
} from '../../ui/generated/graphql';
import { MetricStrategy } from '../metric-strategy';

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

  async loadData(
    ctx: RequestContext,
    injector: Injector,
    from: Date,
    to: Date
  ): Promise<Order[]> {
    let skip = 0;
    const take = 1000;
    let hasMoreOrders = true;
    const orders: Order[] = [];
    while (hasMoreOrders) {
      const [items, totalOrders] = await injector
        .get(TransactionalConnection)
        .getRepository(ctx, Order)
        .createQueryBuilder('order')
        .leftJoin('order.channels', 'orderChannel')
        .where(`orderChannel.id=:channelId`, { channelId: ctx.channelId })
        .andWhere(`order.orderPlacedAt >= :from`, {
          from: from.toISOString(),
        })
        .andWhere(`order.orderPlacedAt <= :to`, {
          to: to.toISOString(),
        })
        .skip(skip)
        .take(take)
        .getManyAndCount();
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

  calculateDataPoint(
    ctx: RequestContext,
    data: Order[],
    monthNr: number
  ): number[] {
    const total = data
      .map((o) => o.totalWithTax)
      .reduce((total, current) => total + current);
    const average = Math.round(total / data.length) / 100;
    return [average];
  }
}
