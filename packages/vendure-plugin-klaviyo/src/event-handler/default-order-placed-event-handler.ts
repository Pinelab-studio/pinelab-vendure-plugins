import { OrderAddress } from '@vendure/common/lib/generated-types';
import {
  Address,
  EntityHydrator,
  Logger,
  OrderPlacedEvent,
  translateDeep,
} from '@vendure/core';
import { loggerCtx } from '../constants';
import { toKlaviyoMoney } from '../util/to-klaviyo-money';
import { KlaviyoOrderPlacedEventHandler } from './klaviyo-event-handler';

export const defaultOrderPlacedEventHandler: KlaviyoOrderPlacedEventHandler = {
  vendureEvent: OrderPlacedEvent,
  mapToKlaviyoEvent: async ({ order, ctx }, injector) => {
    await injector.get(EntityHydrator).hydrate(ctx, order, {
      relations: [
        'lines.productVariant.product.facetValues.facet',
        'lines.productVariant.product.translations',
        'lines.productVariant.collections.children',
        'lines.productVariant.featuredAsset',
        'shippingLines.shippingMethod',
        'customer.addresses.country',
        'customer.user',
      ],
    });
    order.lines.forEach((line) => {
      line.productVariant.product = translateDeep(
        line.productVariant.product,
        ctx.languageCode
      );
    });
    if (!order.customer) {
      Logger.error(
        `Can not send Order placed Event to Klaviyo, because order ${order.code} has no customer`,
        loggerCtx
      );
      return false;
    }
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
