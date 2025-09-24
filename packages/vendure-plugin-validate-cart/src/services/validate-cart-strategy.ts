import {
  Injector,
  Order,
  RelationPaths,
  RequestContext,
  ProductVariantService,
  OrderLine,
} from '@vendure/core';
import { ActiveOrderValidationError } from '../api/generated/graphql';

export interface ValidateCartStrategy {
  /**
   * Determine which relations to load from the order.
   */
  loadOrderRelations?: RelationPaths<Order>;

  /**
   * Validate the active order based on your custom logic.
   */
  validate(
    ctx: RequestContext,
    activeOrder: Order,
    injector: Injector
  ): Promise<ActiveOrderValidationError[]> | ActiveOrderValidationError[];
}

export enum ValidationErrorCodes {
  ITEM_UNAVAILABLE = 'ITEM_UNAVAILABLE',
}

export class DefaultStockValidationStrategy implements ValidateCartStrategy {
  loadOrderRelations: RelationPaths<Order> = [
    'lines.productVariant.stockLevels',
  ];

  async validate(
    ctx: RequestContext,
    activeOrder: Order,
    injector: Injector
  ): Promise<ActiveOrderValidationError[]> {
    // Get order lines with insufficient saleable stock
    const variantService = injector.get(ProductVariantService);
    const orderLinesWithInsufficientStock: OrderLine[] = [];
    await Promise.all(
      activeOrder.lines.map(async (line) => {
        if (!line.productVariant.trackInventory) {
          return; // Ignore products that don't track inventory
        }
        const availableStock = await variantService.getSaleableStockLevel(
          ctx,
          line.productVariant
        );
        if (line.quantity > availableStock) {
          orderLinesWithInsufficientStock.push(line);
        }
      })
    );
    if (orderLinesWithInsufficientStock.length > 0) {
      // Return a single error for all order lines with insufficient stock
      return [
        {
          message: `Insufficient stock for variants: ${orderLinesWithInsufficientStock
            .map((line) => `'${line.productVariant.name}'`)
            .join(', ')}`,
          errorCode: ValidationErrorCodes.ITEM_UNAVAILABLE,
          relatedOrderLineIds: orderLinesWithInsufficientStock.map(
            (line) => line.id
          ),
        },
      ];
    }
    // No errors found for the order
    return [];
  }
}
