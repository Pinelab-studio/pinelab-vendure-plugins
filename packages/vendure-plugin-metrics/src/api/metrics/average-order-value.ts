import {
  Injector,
  Logger,
  Order,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { loggerCtx } from '../../constants';
import { AdvancedMetricType } from '../../ui/generated/graphql';
import { MetricStrategy, NamedDatapoint } from '../metric-strategy';

/**
 * Calculates the average order value per month
 */
export class AverageOrderValueMetric implements MetricStrategy<Order> {
  readonly metricType: AdvancedMetricType = AdvancedMetricType.Currency;
  readonly code = 'aov';
  readonly allowProductSelection = false;

  getTitle(ctx: RequestContext): string {
    return `Average order value`;
  }

  getSortableField(entity: Order): Date {
    return entity.orderPlacedAt ?? entity.updatedAt;
  }

  async loadEntities(
    ctx: RequestContext,
    injector: Injector,
    from: Date,
    to: Date
  ): Promise<Order[]> {
    let skip = 0;
    const take = 5000;
    let hasMoreOrders = true;
    const orders: Order[] = [];
    while (hasMoreOrders) {
      let query = injector
        .get(TransactionalConnection)
        .getRepository(ctx, Order)
        .createQueryBuilder('order')
        .leftJoin('order.channels', 'orderChannel')
        .where(`orderChannel.id=:channelId`, { channelId: ctx.channelId })
        .andWhere('order.orderPlacedAt BETWEEN :fromDate AND :toDate', {
          fromDate: from.toISOString(),
          toDate: to.toISOString(),
        })
        .offset(skip)
        .limit(take);
      const [items, totalOrders] = await query.getManyAndCount();
      orders.push(...items);
      Logger.debug(
        `Fetched orders ${skip}-${skip + take} for metric ${
          this.code
        } for channel${ctx.channel.token}`,
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
    entities: Order[]
  ): NamedDatapoint[] {
    let legendLabel = 'Average order value';
    if (ctx.channel.pricesIncludeTax) {
      legendLabel += ' (incl. tax)';
    } else {
      legendLabel += ' (excl. tax)';
    }
    if (!entities.length) {
      // Return 0 as average if no orders
      return [
        {
          legendLabel,
          value: 0,
        },
      ];
    }
    const totalFieldName = ctx.channel.pricesIncludeTax
      ? 'totalWithTax'
      : 'total';
    const total = entities
      .map((o) => o[totalFieldName])
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
