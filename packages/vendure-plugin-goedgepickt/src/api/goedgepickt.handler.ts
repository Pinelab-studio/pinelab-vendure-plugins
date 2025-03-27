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
    trackingCode: {
      type: 'string',
      required: false,
    },
    trackingUrls: {
      type: 'string',
      required: false,
    },
  },
  init: (injector) => {
    service = injector.get(GoedgepicktService);
  },
  createFulfillment: async (ctx, orders, orderItems, args) => {
    const orderCodes = orders.map((o) => o.code);
    Logger.info(`Fulfilled orders ${orderCodes.join(',')}`, loggerCtx);
    return {
      method: `GoedGepickt - ${args.trackingCode}`,
      trackingCode: args.trackingCode,
      customFields: {
        trackingUrls: args.trackingUrls,
      },
    };
  },
});
