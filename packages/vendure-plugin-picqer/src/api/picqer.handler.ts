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
    throw Error(
      `Don't use fulfillment with Picqer. Directly transition to Shipped or Delivered instead.`
    );
  },
});
