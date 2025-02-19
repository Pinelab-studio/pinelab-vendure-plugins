import { OrderAddress } from '@vendure/common/lib/generated-types';
import {
  Address,
  Logger,
  OrderPlacedEvent,
  OrderService,
  translateDeep,
} from '@vendure/core';
import { loggerCtx } from '../constants';
import { toKlaviyoMoney } from '../util/to-klaviyo-money';
import { KlaviyoOrderPlacedEventHandler } from './klaviyo-event-handler';

export const defaultOrderPlacedEventHandler: KlaviyoOrderPlacedEventHandler = {
  vendureEvent: OrderPlacedEvent,
  mapToKlaviyoEvent: async ({ order: { id, code }, ctx }, injector) => {
    // Refetch order with relations. Don't hydrate to prevent concurrency issues
    const order = await injector
      .get(OrderService)
      .findOne(ctx, id, [
        'lines.productVariant.product.facetValues.facet',
        'lines.productVariant.product.translations',
        'lines.productVariant.collections.children',
        'lines.productVariant.featuredAsset',
        'shippingLines.shippingMethod',
        'customer.addresses.country',
        'customer.user',
      ]);
    if (!order?.customer) {
      Logger.error(
        `Can not send Order placed Event to Klaviyo, because order ${code} has no customer`,
        loggerCtx
      );
      return false;
    }
    order.lines.forEach((line) => {
      line.productVariant = translateDeep(
        line.productVariant,
        ctx.languageCode
      );
    });
    let address: Address | OrderAddress | undefined =
      order.customer.addresses.find((a) => a.defaultShippingAddress);
    if (!address) {
      address = order.shippingAddress;
    }
    return {
      eventName: 'Order Placed',
      uniqueId: order.code,
      orderId: order.code,
      orderPlacedAt: order.orderPlacedAt ?? order.updatedAt,
      totalOrderValue: toKlaviyoMoney(order.totalWithTax),
      profile: {
        emailAddress: order.customer.emailAddress,
        externalId: order.customer.id.toString(),
        firstName: order.customer.firstName,
        lastName: order.customer.lastName,
        phoneNumber: order.customer.phoneNumber,
        address: {
          address1: address?.streetLine1,
          address2: address?.streetLine2,
          city: address?.city,
          postalCode: address?.postalCode,
          countryCode:
            (address as OrderAddress).countryCode ??
            (address as Address)?.country?.code,
        },
      },
      orderItems: order.lines.map((line) => ({
        ProductID: line.productVariant.id.toString(),
        SKU: line.productVariant.sku,
        ProductName: line.productVariant.name,
        Quantity: line.quantity,
        ItemPrice: toKlaviyoMoney(line.proratedUnitPriceWithTax),
        RowTotal: toKlaviyoMoney(line.proratedLinePriceWithTax),
        ImageURL: line.featuredAsset?.preview,
      })),
      customProperties: {},
    };
  },
};
