import { CustomFieldConfig, LanguageCode } from '@vendure/core';
import { StockMonitoringPlugin } from './stock-monitoring.plugin';
import { CustomProductVariantFields } from '@vendure/core/dist/entity/custom-entity-fields';

declare module '@vendure/core' {
  interface CustomProductVariantFields {
    stockMonitoringThreshold?: number;
  }
}

export const customVariantFields: CustomFieldConfig[] = [
  {
    name: 'stockMonitoringThreshold',
    type: 'int',
    public: false,
    nullable: true,
    label: [
      { value: 'Stock Monitoring Threshold', languageCode: LanguageCode.en },
    ],
    description: [
      {
        value: 'Notify when stock is below this threshold',
        languageCode: LanguageCode.en,
      },
      {
        value: 'Waarschuw wanneer de voorraad onder deze drempel komt',
        languageCode: LanguageCode.nl,
      },
    ],
    ui: { tab: StockMonitoringPlugin?.options?.uiTab },
  },
];

declare module '@vendure/core/dist/entity/custom-entity-fields' {
  interface CustomProductVariantFields {
    stockMonitoringThreshold?: number;
  }
}
