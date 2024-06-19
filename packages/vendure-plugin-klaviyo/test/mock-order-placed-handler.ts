import { EntityHydrator, OrderPlacedEvent, translateDeep } from "@vendure/core";
import { KlaviyoEventHandler, KlaviyoOrderItem, toKlaviyoMoney } from "../src";

/**
 * Mock custom Klaviyo handler to test custom and additional properties
 */
export const mockOrderPlacedHandler: KlaviyoEventHandler<OrderPlacedEvent> = {
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
            return false;
        }
        return {
            eventName: 'Custom Order Placed',
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
                address: {},
            },
            orderItems: <KlaviyoOrderItem[]> order.lines.map((line) => ({
                Brand: 'Test Brand',
                ProductURL: 'https://pinelab.studio/product/some-product',
                Categories: ['Some mock category'],
                customProperties: {
                    customOrderItemProp: 'my custom order item value',
                },
                ProductID: line.productVariant.id.toString(),
                SKU: line.productVariant.sku,
                ProductName: line.productVariant.name,
                Quantity: line.quantity,
                ItemPrice: toKlaviyoMoney(line.proratedUnitPriceWithTax),
                RowTotal: toKlaviyoMoney(line.proratedLinePriceWithTax),
                ImageURL: 'custom-image-url.png',
            })),
            customProperties: {
                customOrderProp: 'my custom order value',
            },
        };
    },
}