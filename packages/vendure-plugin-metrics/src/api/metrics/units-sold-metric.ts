import {
  Injector,
  Logger,
  OrderLine,
  ProductVariant,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { AdvancedMetricType } from '../../ui/generated/graphql';
import { MetricStrategy, NamedDatapoint } from '../metric-strategy';
import { loggerCtx } from '../../constants';

/**
 * Calculates the number of products sold per month.
 * calculates the sum of all items in an order if no variantIds are provided
 */
export class UnitsSoldMetric implements MetricStrategy<OrderLine> {
  readonly metricType: AdvancedMetricType = AdvancedMetricType.Number;
  readonly code = 'units-sold';
  readonly allowProductSelection = true;

  getTitle(ctx: RequestContext): string {
    return `Units sold`;
  }

  getSortableField(entity: OrderLine): Date {
    return entity.order.orderPlacedAt ?? entity.order.updatedAt;
  }

  async loadEntities(
    ctx: RequestContext,
    injector: Injector,
    from: Date,
    to: Date,
    variants: ProductVariant[]
  ): Promise<OrderLine[]> {
    let skip = 0;
    const take = 1000;
    let hasMoreOrderLines = true;
    const lines: OrderLine[] = [];
    while (hasMoreOrderLines) {
      let query = injector
        .get(TransactionalConnection)
        .getRepository(ctx, OrderLine)
        .createQueryBuilder('orderLine')
        .leftJoin('orderLine.order', 'order')
        .select([
          'order.id',
          'order.orderPlacedAt',
          'orderLine.id',
          'orderLine.quantity',
        ])
        .leftJoin('order.channels', 'channel')
        .where(`channel.id=:channelId`, { channelId: ctx.channelId })
        .andWhere('order.orderPlacedAt BETWEEN :fromDate AND :toDate', {
          fromDate: from.toISOString(),
          toDate: to.toISOString(),
        })
        .skip(skip)
        .take(take);
      if (variants.length) {
        query = query
          .leftJoin('orderLine.productVariant', 'productVariant')
          .addSelect(['productVariant.sku', 'productVariant.id'])
          .andWhere(`productVariant.id IN(:...variantIds)`, {
            variantIds: variants.map((v) => v.id),
          });
      }
      const [items, totalItems] = await query.getManyAndCount();
      lines.push(...items);
      Logger.debug(
        `Fetched order lines ${skip}-${skip + take} for metric ${
          this.code
        } for channel${ctx.channel.token}`,
        loggerCtx
      );
      skip += items.length;
      if (lines.length >= totalItems) {
        hasMoreOrderLines = false;
      }
    }
    return lines;
  }

  calculateDataPoints(
    ctx: RequestContext,
    lines: OrderLine[],
    variants: ProductVariant[]
  ): NamedDatapoint[] {
    // Return the nr of products sold
    if (!variants.length) {
      // Return total sum of quantities if no variantIds given
      const total = lines
        .map((line) => line.quantity)
        .reduce((total, current) => total + current, 0);
      return [
        {
          legendLabel: 'Total of all variants',
          value: total,
        },
      ];
    }
    // Else calculate sum per variant
    const dataPoints: NamedDatapoint[] = [];
    variants.forEach((variant) => {
      // Find order lines per variant id
      const linesForVariant = lines.filter(
        (line) => line.productVariant.id === variant.id
      );
      // Sum of quantities for this variant
      const sum = linesForVariant.reduce(
        (total, current) => total + current.quantity,
        0
      );
      dataPoints.push({
        legendLabel: variant.name,
        value: sum,
      });
    });
    return dataPoints;
  }
}
