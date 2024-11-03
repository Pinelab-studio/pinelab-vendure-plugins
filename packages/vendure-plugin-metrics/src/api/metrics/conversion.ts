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

// Minimal order with only the fields needed for the metric
type OrderWithDates = Pick<Order, 'orderPlacedAt' | 'updatedAt'>;

/**
 * Calculates the average order value per month
 */
export class ConversionMetric implements MetricStrategy<OrderWithDates> {
  readonly metricType: AdvancedMetricType = AdvancedMetricType.Number;
  readonly code = 'conversion';
  readonly allowProductSelection = false;

  getTitle(ctx: RequestContext): string {
    return `Conversion`;
  }

  getSortableField(entity: Order): Date {
    return entity.orderPlacedAt ?? entity.updatedAt;
  }

  async loadEntities(
    ctx: RequestContext,
    injector: Injector,
    from: Date,
    to: Date
  ): Promise<OrderWithDates[]> {
    let skip = 0;
    const take = 5000;
    let hasMoreOrders = true;
    const orders: Order[] = [];
    const fromDate = from.toISOString();
    const toDate = to.toISOString();
    while (hasMoreOrders) {
      let query = injector
        .get(TransactionalConnection)
        .getRepository(ctx, Order)
        .createQueryBuilder('order')
        .select(['order.orderPlacedAt', 'order.updatedAt'])
        .leftJoin('order.channels', 'orderChannel')
        .where(`orderChannel.id=:channelId`, { channelId: ctx.channelId })
        .where('order.orderPlacedAt BETWEEN :fromDate AND :toDate', {
          fromDate,
          toDate,
        })
        .orWhere(
          'order.orderPlacedAt IS NULL AND order.updatedAt BETWEEN :fromDate AND :toDate',
          { fromDate, toDate }
        )
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
    entities: OrderWithDates[]
  ): NamedDatapoint[] {
    let legendLabel = 'Conversion %';
    if (!entities.length) {
      // Return 0 as average if no orders
      return [
        {
          legendLabel,
          value: 0,
        },
      ];
    }
    const totalOrders = entities.length;
    const placedOrders = entities.filter((o) => o.orderPlacedAt).length;
    const placedPercentage = (placedOrders / totalOrders) * 100;
    return [
      {
        legendLabel,
        value: Math.round(placedPercentage * 100) / 100,
      },
    ];
  }
}
