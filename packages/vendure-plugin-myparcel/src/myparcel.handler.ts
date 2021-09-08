import { FulfillmentHandler, LanguageCode, Logger } from "@vendure/core";
import { MyparcelService } from "./myparcel.service";
import { MyparcelPlugin } from "./myparcel.plugin";

export const myparcelHandler = new FulfillmentHandler({
  code: "my-parcel",
  description: [
    {
      languageCode: LanguageCode.en,
      value: "Send order to MyParcel"
    }
  ],
  args: {},
  createFulfillment: async (ctx, orders, orderItems, args) => {
    const shipment = await MyparcelService.createShipments(
      ctx.channel.token,
      orders
    ).catch((err: Error) => {
        Logger.error(err.message, MyparcelPlugin.loggerCtx, err.stack);
        throw err;
      }
    );
    console.log("shipment", shipment);
    return {
      method: "MyParcel",
      trackingCode: "Do a test code"
    };
  }
});
