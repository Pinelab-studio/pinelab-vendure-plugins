import {
  FulfillmentHandler,
  Injector,
  LanguageCode,
  Logger,
} from '@vendure/core';
import { MyparcelService } from './myparcel.service';
import { loggerCtx } from '../constants';

let myparcelService: MyparcelService;
export const myparcelHandler = new FulfillmentHandler({
  code: 'my-parcel',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Send order to MyParcel',
    },
  ],
  args: {
    customsContents: {
      type: 'string',
      required: false,
      defaultValue: '',
      label: [
        {
          languageCode: LanguageCode.en,
          value: 'Type of contents in the package.',
        },
      ],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Only select this for shipments outside the EU!',
        },
      ],
      ui: {
        component: 'select-form-input',
        options: [
          {
            value: '',
            label: [{ languageCode: LanguageCode.en, value: '-' }],
          },
          {
            value: 1,
            label: [
              { languageCode: LanguageCode.en, value: '1. Commercial goods' },
            ],
          },
          {
            value: 2,
            label: [
              { languageCode: LanguageCode.en, value: '2. Commercial samples' },
            ],
          },
          {
            value: 3,
            label: [{ languageCode: LanguageCode.en, value: '3. Documents' }],
          },
          {
            value: 4,
            label: [{ languageCode: LanguageCode.en, value: '4. Gifts' }],
          },
          {
            value: 5,
            label: [
              { languageCode: LanguageCode.en, value: '5. Return shipment' },
            ],
          },
        ],
      },
    },
  },
  init: (injector: Injector) => {
    myparcelService = injector.get(MyparcelService);
  },
  createFulfillment: async (ctx, orders, orderItems, args) => {
    const shipmentId = await myparcelService
      .createShipments(ctx, orders, args.customsContents)
      .catch((err) => {
        Logger.error(err?.message, loggerCtx, err?.stack);
        throw err;
      });
    return {
      method: shipmentId,
    };
  },
});
