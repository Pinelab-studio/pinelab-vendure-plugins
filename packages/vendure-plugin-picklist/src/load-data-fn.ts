import {
  Injector,
  Order,
  RequestContext,
  translateEntity,
} from '@vendure/core';

export type LoadDataFn = (
  ctx: RequestContext,
  injector: Injector,
  order: Order
) => Promise<DefaultPicklistData>;

interface DefaultPicklistData {
  orderDate: string;
  customerEmail: string;
  order: Partial<Order>;
}

export const defaultLoadDataFn: LoadDataFn = async (
  ctx: RequestContext,
  injector: Injector,
  order: Order
): Promise<DefaultPicklistData> => {
  order.lines.forEach((line) => {
    line.productVariant = translateEntity(
      line.productVariant,
      ctx.languageCode
    );
  });
  if (!order.customer?.emailAddress) {
    throw Error(`Order doesnt have a customer.email set!`);
  }
  return {
    orderDate: order.orderPlacedAt
      ? new Intl.DateTimeFormat('nl-NL').format(order.orderPlacedAt)
      : new Intl.DateTimeFormat('nl-NL').format(order.updatedAt),
    customerEmail: order.customer.emailAddress,
    order,
  };
};
