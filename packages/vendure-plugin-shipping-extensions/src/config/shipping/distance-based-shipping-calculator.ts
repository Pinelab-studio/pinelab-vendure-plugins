import {
  LanguageCode,
  ShippingCalculator,
  Injector,
  InternalServerError,
  Logger,
} from '@vendure/core';
import { ShippingExtensionsOptions } from '../../shipping-extensions.plugin';
import { loggerCtx, PLUGIN_OPTIONS } from '../../constants';
import { getDistanceBetweenPointsInKMs } from '../../util/get-distance-between-points';
import { getHighestTaxRateOfOrder } from './shipping-util';

let pluginOptions: ShippingExtensionsOptions;
let injector: Injector;
export const distanceBasedShippingCalculator = new ShippingCalculator({
  code: 'distance-based-shipping-calculator',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Distance Based Shipping Calculator',
    },
  ],
  args: {
    storeLatitude: {
      type: 'float',
      ui: { component: 'number-form-input', min: -90, max: 90 },
      label: [{ languageCode: LanguageCode.en, value: 'Store Latitude' }],
    },
    storeLongitude: {
      type: 'float',
      ui: { component: 'number-form-input', min: -180, max: 180 },
      label: [{ languageCode: LanguageCode.en, value: 'Store Longitude' }],
    },
    pricePerKm: {
      type: 'int',
      ui: { component: 'currency-form-input' },
      label: [{ languageCode: LanguageCode.en, value: 'Price per KM' }],
    },
    minPrice: {
      type: 'int',
      ui: { component: 'currency-form-input' },
      label: [
        {
          languageCode: LanguageCode.en,
          value: 'MinimumPrice',
        },
      ],
    },
  },
  init(_injector: Injector) {
    pluginOptions = _injector.get<ShippingExtensionsOptions>(PLUGIN_OPTIONS);
    injector = _injector;
  },
  calculate: async (ctx, order, args, method) => {
    if (!pluginOptions?.orderAddressToGeolocationStrategy) {
      throw new InternalServerError(
        'OrderAddress to geolocation conversion strategy not configured'
      );
    }
    const taxRate = await getHighestTaxRateOfOrder(ctx, injector, order);
    const storeGeoLocation = {
      latitude: args.storeLatitude,
      longitude: args.storeLongitude,
    };
    // Used as fallback when order shipping address is not available or something goes wrong
    const minimumPrice = {
      price: args.minPrice,
      priceIncludesTax: ctx.channel.pricesIncludeTax,
      taxRate,
      metadata: { storeGeoLocation },
    };
    if (
      !order?.shippingAddress?.postalCode ||
      !order.shippingAddress?.countryCode
    ) {
      return minimumPrice;
    }
    try {
      const shippingAddressGeoLocation =
        await pluginOptions.orderAddressToGeolocationStrategy.getGeoLocationForAddress(
          order.shippingAddress
        );
      if (!shippingAddressGeoLocation) {
        return minimumPrice;
      }
      const distance = getDistanceBetweenPointsInKMs(
        shippingAddressGeoLocation,
        storeGeoLocation
      );
      let price = distance * args.pricePerKm;
      if (price < args.minPrice) {
        price = args.minPrice;
      }
      return {
        price,
        priceIncludesTax: ctx.channel.pricesIncludeTax,
        taxRate,
        metadata: { shippingAddressGeoLocation, storeGeoLocation },
      };
    } catch (e) {
      //eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      Logger.error(
        //eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Failed to calculate shipping for ${method.name}: ${
          (e as Error)?.message
        }`,
        loggerCtx
      );
      return minimumPrice;
    }
  },
});
