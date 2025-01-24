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
) => Promise<any>;

export const defaultLoadDataFn: LoadDataFn = async (
  ctx: RequestContext,
  injector: Injector,
  order: Order
): Promise<any> => {
  order.lines.forEach((line) => {
    line.productVariant = translateEntity(
      line.productVariant,
      ctx.languageCode
    );
  });
  return {
    orderDate: order.orderPlacedAt
      ? new Intl.DateTimeFormat('nl-NL').format(order.orderPlacedAt)
      : new Intl.DateTimeFormat('nl-NL').format(order.updatedAt),
    order,
  };
};
