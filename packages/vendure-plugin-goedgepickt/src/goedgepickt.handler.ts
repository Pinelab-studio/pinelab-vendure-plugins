import { EntityHydrator, FulfillmentHandler, Injector, LanguageCode, OrderItem, OrderService } from "@vendure/core";
import { GoedgepicktService } from "./goedgepickt.service";

let goedgepicktService: GoedgepicktService;
let hydrator: EntityHydrator;
export const goedgepicktHandler = new FulfillmentHandler({
  code: "goedgepickt",
  description: [
    {
      languageCode: LanguageCode.en,
      value: "Send order to Goedgepickt"
    }
  ],
  args: {},
  init: (injector: Injector) => {
    goedgepicktService = injector.get(GoedgepicktService);
    hydrator = injector.get(EntityHydrator);
  },
  createFulfillment: async (ctx, orders, orderItems, args) => {
    const externalIds = [];
    await Promise.all(orderItems.map(item => hydrator.hydrate(ctx, item, { relations: ['line.order', 'line.productVariant',]})));
    for(const order of orders) {
      // Get only items for this order
      const itemsPerOrder = orderItems.filter(item => item.line.order.id === order.id);
      const ggOrder = await goedgepicktService.createOrder(ctx.channel.token, order, itemsPerOrder)
      externalIds.push(ggOrder.orderUuid);
    }
    return {
      method: externalIds.length === 1 ? externalIds[0] : externalIds.join(',')
    }
  }
});
