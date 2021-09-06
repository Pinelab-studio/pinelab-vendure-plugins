import { FulfillmentHandler, LanguageCode } from '@vendure/core';
import { MyparcelService } from "./myparcel.service";

export const myparcelHandler = new FulfillmentHandler({
  code: 'my-parcel',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Send order to MyParcel',
    },
  ],
  args: {},
  createFulfillment: async (ctx, orders, orderItems, args) => {
    const shipment = await MyparcelService.createShipments(ctx.channel.token, orders);
    console.log('shipment', shipment);
    return {
      method: 'MyParcel',
      trackingCode: 'Do a test code',
    };
  },
});
