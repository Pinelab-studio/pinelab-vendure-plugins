import {
  LanguageCode,
  ShippingCalculator,
  Injector,
  InternalServerError,
} from '@vendure/core';
import { ShippingExtensionsOptions } from './shipping-extensions.plugin';
import { PLUGIN_OPTIONS } from './constants';
import { getDistanceBetweenPointsInKMs } from './get-distance-between-points';

let pluginOptions: ShippingExtensionsOptions;
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
      type: 'float',
      ui: { component: 'currency-form-input' },
      label: [{ languageCode: LanguageCode.en, value: 'Price per KM' }],
    },
    taxRate: {
      type: 'float',
      ui: { component: 'number-form-input', suffix: '%', min: 0, max: 100 },
      label: [{ languageCode: LanguageCode.en, value: 'Tax rate' }],
    },
  },
  init(injector: Injector) {
    pluginOptions = injector.get<ShippingExtensionsOptions>(PLUGIN_OPTIONS);
  },
  calculate: async (ctx, order, args) => {
    if (!pluginOptions?.orderAddressToGeolocationStrategy) {
      throw new InternalServerError(
        'OrderAddress to geolocation conversion strategy not configured'
      );
    }
    const storeGeoLocation = {
      latitude: args.storeLatitude,
      longitude: args.storeLongitude,
    };
    const shippingAddressGeoLocation =
      await pluginOptions.orderAddressToGeolocationStrategy.getGeoLocationForAddress(
        order.shippingAddress
      );
    const distance = getDistanceBetweenPointsInKMs(
      shippingAddressGeoLocation,
      storeGeoLocation
    );
    const rate = distance * args.pricePerKm * (1 + args.taxRate / 100);
    return {
      price: rate,
      priceIncludesTax: ctx.channel.pricesIncludeTax,
      taxRate: args.taxRate,
      metadata: { shippingAddressGeoLocation, storeGeoLocation },
    };
  },
});
