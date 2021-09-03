import { FulfillmentHandler, LanguageCode } from "@vendure/core";
import { MyparcelPlugin } from "./myparcel.plugin";

export const myparcelHandler = new FulfillmentHandler({
  code: 'my-parcel',
  description: [{ languageCode: LanguageCode.en, value: 'Manually enter fulfillment details' }],
  args: {
    method: {
      type: 'string',
      required: false,
    },
    trackingCode: {
      type: 'string',
      required: false,
    },
  },
  createFulfillment: (ctx, orders, orderItems, args) => {
    const apiKey = MyparcelPlugin.apiKeys[ctx.channel.token];
    console.log(apiKey);
    return {
      method: 'MyParcel',
      trackingCode: args.trackingCode,
    };
  },
});