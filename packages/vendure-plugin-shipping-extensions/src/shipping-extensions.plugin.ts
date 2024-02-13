import {
  LanguageCode,
  Order,
  PluginCommonModule,
  VendurePlugin,
} from '@vendure/core';
import { weightAndCountryChecker } from './weight-and-country-checker';
import { OrderAddressToGeolocationConversionStrategy } from './strategies/order-address-to-geolocation-strategy';
import { PLUGIN_OPTIONS } from './constants';
import { distanceBasedShippingCalculator } from './distance-based-shipping-calculator';

export interface ShippingExtensionsOptions {
  /**
   * The unit of weight you would like to use as for the weight customfield
   * and the unit used in the eligibility checker.
   * Only used for display purposes
   * Defaults is `grams`
   */
  weightUnit?: string;
  /**
   * The name of the tab you want the customfield Product.weight to appear in.
   * This can be an existing tab. For example: 'Physical properties'
   */
  customFieldsTab?: string;

  /**
   * A custom function to calculate the total weight of an order.
   * By default the shipping eligibility checker will use the weight custom fields.
   */
  weightCalculationFunction?: (order: Order) => number;

  /**
   * The selected strategy to convert (OrderAddress)[https://docs.vendure.io/reference/graphql-api/shop/object-types/#orderaddress] values to lat/lon values
   * to be used when calculating distance based shipping price
   */
  orderAddressToGeolocationStrategy?: OrderAddressToGeolocationConversionStrategy;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: PLUGIN_OPTIONS,
      useFactory: () => ShippingExtensionsPlugin.options,
    },
  ],
  configuration: (config) => {
    config.shippingOptions.shippingEligibilityCheckers.push(
      weightAndCountryChecker
    );
    config.customFields.Product.push({
      name: 'weight',
      label: [
        {
          languageCode: LanguageCode.en,
          value: `Weight in ${ShippingExtensionsPlugin.options?.weightUnit}`,
        },
      ],
      ui: {
        component: 'number-form-input',
        tab: ShippingExtensionsPlugin.options?.customFieldsTab,
        options: { min: 0 },
      },
      public: true,
      nullable: true,
      type: 'int',
    });
    config.customFields.ProductVariant.push({
      name: 'weight',
      label: [
        {
          languageCode: LanguageCode.en,
          value: `Weight in ${ShippingExtensionsPlugin.options?.weightUnit}`,
        },
      ],
      ui: {
        component: 'number-form-input',
        tab: ShippingExtensionsPlugin.options?.customFieldsTab,
        options: { min: 0 },
      },
      public: true,
      nullable: true,
      type: 'int',
    });
    config.shippingOptions.shippingCalculators.push(
      distanceBasedShippingCalculator
    );
    return config;
  },
  compatibility: '^2.0.0',
})
export class ShippingExtensionsPlugin {
  static options: ShippingExtensionsOptions;

  static init(
    options: ShippingExtensionsOptions
  ): typeof ShippingExtensionsPlugin {
    if (!options.weightUnit) {
      options.weightUnit = 'grams';
    }
    this.options = options;
    return ShippingExtensionsPlugin;
  }
}
