import { Injector, ProductVariantService, RequestContext } from '@vendure/core';
import { MetricChart, MetricDefinition } from '../src';

/** Test/dev chart of the current channel's variant prices, without variations. */
export class VariantPricesMetric implements MetricDefinition {
  readonly code = 'variant_prices';
  readonly perChannel = true;

  /** Load every non-deleted variant in the channel, including disabled variants. */
  async loadChart(
    ctx: RequestContext,
    injector: Injector,
  ): Promise<MetricChart> {
    const service = injector.get(ProductVariantService);
    const labels: string[] = [];
    const prices: number[] = [];
    let totalItems: number;
    do {
      const result = await service.findAll(ctx, {
        skip: labels.length,
        take: 100,
        sort: { id: 'ASC' },
      });
      totalItems = result.totalItems;
      for (const variant of result.items) {
        labels.push(`${variant.name} (${variant.sku})`);
        prices.push(variant.price);
      }
    } while (labels.length < totalItems);

    return {
      title: 'Variant prices',
      type: 'pie',
      valueFormat: 'currency',
      data: {
        labels,
        datasets: [
          {
            label: 'Price',
            data: prices,
          },
        ],
      },
    };
  }
}
