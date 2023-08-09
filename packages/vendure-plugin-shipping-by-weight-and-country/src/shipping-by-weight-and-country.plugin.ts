import { LanguageCode, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { weightAndCountryChecker } from './weight-and-country-checker';

export interface ShippingByWeightAndCountryOptions {
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
}

@VendurePlugin({
  imports: [PluginCommonModule],
  configuration: (config) => {
    config.shippingOptions.shippingEligibilityCheckers.push(
      weightAndCountryChecker
    );
    config.customFields.Product.push({
      name: 'weight',
      label: [
        {
          languageCode: LanguageCode.en,
          value: `Weight in ${ShippingByWeightAndCountryPlugin.options?.weightUnit}`,
        },
      ],
      ui: {
        component: 'number-form-input',
        tab: ShippingByWeightAndCountryPlugin.options?.customFieldsTab,
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
          value: `Weight in ${ShippingByWeightAndCountryPlugin.options?.weightUnit}`,
        },
      ],
      ui: {
        component: 'number-form-input',
        tab: ShippingByWeightAndCountryPlugin.options?.customFieldsTab,
        options: { min: 0 },
      },
      public: true,
      nullable: true,
      type: 'int',
    });
    return config;
  },
  compatibility: '^2.0.0',
})
export class ShippingByWeightAndCountryPlugin {
  static options: ShippingByWeightAndCountryOptions;

  static init(
    options: ShippingByWeightAndCountryOptions
  ): typeof ShippingByWeightAndCountryPlugin {
    if (!options.weightUnit) {
      options.weightUnit = 'grams';
    }
    this.options = options;
    return ShippingByWeightAndCountryPlugin;
  }
}
