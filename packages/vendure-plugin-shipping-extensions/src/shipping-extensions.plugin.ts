import {
  Injector,
  LanguageCode,
  Order,
  PluginCommonModule,
  RequestContext,
  VendurePlugin,
} from '@vendure/core';
import { weightAndCountryChecker } from './config/weight-and-country-checker';
import { OrderAddressToGeolocationConversionStrategy } from './strategies/order-address-to-geolocation-strategy';
import { PLUGIN_OPTIONS } from './constants';
import { distanceBasedShippingCalculator } from './config/distance-based-shipping-calculator';
import { orderInCountryPromotionCondition } from './config/order-in-country-promotion-condition';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { zoneAwareFlatRateShippingCalculator } from './config/zone-aware-flat-rate-shipping-calculator';
import { ZoneAwareShippingTaxCalculationService } from './services/zone-aware-shipping-tax-calculation.service';
import { facetAndCountryChecker } from './config/facet-and-country-checker';

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
  weightCalculationFunction?: (
    ctx: RequestContext,
    order: Order,
    injector: Injector
  ) => Promise<number>;

  /**
   * The selected strategy to convert (OrderAddress)[https://docs.vendure.io/reference/graphql-api/shop/object-types/#orderaddress] values to lat/lon values
   * to be used when calculating distance based shipping price
   */
  orderAddressToGeolocationStrategy?: OrderAddressToGeolocationConversionStrategy;
  /**
   * Additional eligibility check that is appended to all shipping eligibility checkers in this plugin.
   *
   * E.g. you have a product that customers can only pick up in store. You can then do something like:
   * `additionalShippingEligibilityCheck: (ctx, injector, order) => {if(orderContainsSpecialItem) return false;}`
   */
  additionalShippingEligibilityCheck?: (
    ctx: RequestContext,
    injector: Injector,
    order: Order
  ) => Promise<boolean> | boolean;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: PLUGIN_OPTIONS,
      useFactory: () => ShippingExtensionsPlugin.options,
    },
    ZoneAwareShippingTaxCalculationService,
  ],
  configuration: (config) => {
    config.shippingOptions.shippingEligibilityCheckers.push(
      weightAndCountryChecker
    );
    config.shippingOptions.shippingEligibilityCheckers.push(
      facetAndCountryChecker
    );
    config.promotionOptions.promotionConditions.push(
      orderInCountryPromotionCondition
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
      distanceBasedShippingCalculator,
      zoneAwareFlatRateShippingCalculator
    );
    return config;
  },
  compatibility: '>=2.2.0',
  exports: [ZoneAwareShippingTaxCalculationService],
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

  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    providers: ['providers.ts'],
  };
}
