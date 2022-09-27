import {
  FulfillmentHandler,
  Injector,
  LanguageCode,
  Logger,
} from '@vendure/core';
import { SendcloudService } from './sendcloud.service';
import { loggerCtx } from './constants';

let sendcloudService: SendcloudService;
export const sendcloudHandler = new FulfillmentHandler({
  code: 'sendcloud',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Send order to SendCloud',
    },
  ],
  args: {},
  init: (injector: Injector) => {
    sendcloudService = injector.get(SendcloudService);
  },
  createFulfillment: async (ctx, orders, orderItems, args) => {
    const externalIds: (string | number)[] = [];
    const trackingCodes: (string | number)[] = [];
    await Promise.all(
      orders.map(async (order) => {
        // const { id, tracking_number } = await sendcloudService
        const { id, tracking_number } = await sendcloudService
          .syncToSendloud(ctx, order)
          .catch((err: unknown) => {
            if (err instanceof Error) {
              Logger.error(err.message, loggerCtx, err.stack);
            } else {
              Logger.error(err as any, loggerCtx);
            }
            throw err;
          });
        externalIds.push(id);
        trackingCodes.push(tracking_number);
      })
    );
    return {
      method: 'SendCloud: ' + externalIds.join(','),
      trackingCode: trackingCodes.join(','),
      customFields: {
        parcelIds: externalIds,
      },
    };
  },
});
