import { FulfillmentHandler, LanguageCode } from '@vendure/core';

export const goedgepicktHandler = new FulfillmentHandler({
  code: 'goedgepickt',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'GoedGepickt fulfilment',
    },
  ],
  args: {},
  createFulfillment: () => {
    throw Error(
      `Don't use fulfillment with GoedGepickt. Directly transition to Shipped or Delivered instead.`
    );
  },
});
