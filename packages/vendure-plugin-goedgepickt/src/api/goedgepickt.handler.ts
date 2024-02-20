import { FulfillmentHandler, LanguageCode, Logger } from '@vendure/core';
import { GoedgepicktService } from './goedgepickt.service';
import { loggerCtx } from '../constants';

let service: GoedgepicktService;
export const goedgepicktHandler = new FulfillmentHandler({
  code: 'goedgepickt',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Send order to Goedgepickt',
    },
  ],
  args: {
    goedGepicktOrderUUID: {
      type: 'string',
      required: false,
    },
  },
  init: (injector) => {
    service = injector.get(GoedgepicktService);
  },
  createFulfillment: async (ctx, orders, orderItems, args) => {
    let trackingCodes: string[] = [];
    let trackingUrls: string[] = [];
    if (args.goedGepicktOrderUUID) {
      try {
        const client = await service.getClientForChannel(ctx);
        if (!client) {
          throw Error(`GoedGepickt plugin is not enabled for this channel`);
        }
        const order = await client.getOrder(args.goedGepicktOrderUUID);
        order.shipments?.forEach((shipment) => {
          if (shipment?.trackTraceCode) {
            trackingCodes.push(shipment.trackTraceCode);
          }
          if (shipment?.trackTraceUrl) {
            trackingUrls.push(shipment.trackTraceUrl);
          }
        });
      } catch (e: any) {
        Logger.warn(
          `Unable to get tracking info for order with UUID ${args.goedGepicktOrderUUID} from Goedgepickt during fulfillment: ${e?.message}`,
          loggerCtx,
        );
      }
    }
    const orderCodes = orders.map((o) => o.code);
    Logger.info(`Fulfilled orders ${orderCodes.join(',')}`, loggerCtx);
    return {
      method: `GoedGepickt - ${trackingUrls.join(',')}`,
      trackingCode: trackingCodes.join(','),
      customFields: {
        trackingCodes,
      },
    };
  },
});
