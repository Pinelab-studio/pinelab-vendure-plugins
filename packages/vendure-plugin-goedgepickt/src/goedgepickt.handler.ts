import { FulfillmentHandler, Injector, LanguageCode } from '@vendure/core';

export const goedgepicktHandler = new FulfillmentHandler({
  code: 'goedgepickt',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Send order to Goedgepickt',
    },
  ],
  args: {},
  init: (injector: Injector) => {},
  createFulfillment: async (ctx, orders, orderItems, args) => {
    // TODO
    throw Error('not implemented');
  },
});
