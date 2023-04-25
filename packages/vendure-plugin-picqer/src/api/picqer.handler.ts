import { FulfillmentHandler, LanguageCode, Logger } from '@vendure/core';
import { loggerCtx } from '../constants';
import { PicqerService } from './picqer.service';

let service: PicqerService;

export const picqerHandler = new FulfillmentHandler({
  code: 'picqer',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Fulfillment with Picqer',
    },
  ],
  args: {},
  init: (injector) => {
    service = injector.get(PicqerService);
  },
  createFulfillment: async (ctx, orders, orderItems, args) => {
    orders.forEach((order) =>
      Logger.info(`Fulfilled order ${order.code} with Picqer`, loggerCtx)
    );
    // We can fetch track and trace codes from the Picqer API here
    return {
      method: `Picqer`,
    };
  },
});
