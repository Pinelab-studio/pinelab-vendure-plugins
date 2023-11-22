import {
  Injector,
  LanguageCode,
  PromotionCondition,
  TransactionalConnection,
  Order,
} from '@vendure/core';

let injector: Injector;
/**
 * Checks if a customer has placed a certain number of orders before.
 */
export const minOrdersPlacedPromotionCondition = new PromotionCondition({
  code: 'minimum_orders_placed',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Customer has placed { minimum } orders',
    },
  ],
  args: {
    minimum: {
      type: 'int',
      defaultValue: 1,
    },
    maximum: {
      type: 'int',
      defaultValue: 9999,
    },
  },
  init(_injector) {
    injector = _injector;
  },
  async check(ctx, order, args) {
    if (!order.customerId) {
      return false;
    }
    const placedOrderCount = await injector
      .get(TransactionalConnection)
      .getRepository(ctx, Order)
      .createQueryBuilder('order')
      .where('order.customerId = :customerId', { customerId: order.customerId })
      .andWhere('orderPlacedAt IS NOT NULL')
      .getCount();
    return args.minimum <= placedOrderCount && placedOrderCount <= args.maximum;
  },
});
