import { FulfillmentHandler, LanguageCode } from '@vendure/core';

export const picqerHandler = new FulfillmentHandler({
  code: 'picqer',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Fulfillment with Picqer',
    },
  ],
  args: {},
  init: () => {},
  createFulfillment: () => {
    throw Error(
      `Don't use fulfillment with Picqer. Directly transition to Shipped or Delivered instead.`
    );
  },
});
