import {
  FulfillmentHandler,
  Injector,
  LanguageCode,
  Logger,
} from '@vendure/core';
import { MyparcelService } from './myparcel.service';
import { MyparcelPlugin } from '../myparcel.plugin';

let myparcelService: MyparcelService;
export const myparcelHandler = new FulfillmentHandler({
  code: 'my-parcel',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Send order to MyParcel',
    },
  ],
  args: {},
  init: (injector: Injector) => {
    myparcelService = injector.get(MyparcelService);
  },
  createFulfillment: async (ctx, orders, orderItems, args) => {
    const shipmentId = await myparcelService
      .createShipments(ctx.channel.token, orders)
      .catch((err: Error) => {
        Logger.error(err.message, MyparcelPlugin.loggerCtx, err.stack);
        throw err;
      });
    return {
      method: shipmentId,
    };
  },
});
