import {
  Injector,
  Order,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { ParcelInputItem } from './types/sendcloud-api.types';

/**
 * Add nr of previously placed orders for this customer as parcelItem
 */
export async function getNrOfOrders(
  ctx: RequestContext,
  injector: Injector,
  order: Order,
): Promise<ParcelInputItem> {
  let nrOfOrders = 0;
  if (order.customer?.id) {
    const orders = await injector
      .get(TransactionalConnection)
      .getRepository(ctx, Order)
      .find({
        where: {
          customer: { id: order.customer.id },
          state: 'Delivered',
        },
      });
    nrOfOrders = orders.length;
  }
  return {
    description: String(nrOfOrders),
    quantity: 1,
    weight: '0.1',
    sku: `Nr of orders`,
    value: '0',
  };
}

/**
 * Return couponCodes as Sendcloud parcelInputItem
 */
export function getCouponCodes(order: Order): ParcelInputItem | undefined {
  if (!order.couponCodes || order.couponCodes.length === 0) {
    return;
  }
  const couponCodesString = order.couponCodes.join(',');
  return {
    description: couponCodesString,
    quantity: 1,
    weight: '0.1',
    sku: `Couponcodes`,
    value: '0',
  };
}
