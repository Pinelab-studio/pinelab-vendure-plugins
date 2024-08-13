import {
  LanguageCode,
  PluginCommonModule,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { gql } from 'graphql-tag';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { OrderByPopularityController } from './popularity.controller';
import { PopularityScoresService } from './popularity-scores.service';

export interface PopularityScoresPluginConfig {
  /**
   * Prevent unauthenticated requests to the calculation endpoint
   */
  endpointSecret: string;
  /**
   * chunk size for product score summing query
   *
   * @default 100
   */
  chunkSize?: number;
  productFieldUiTab?: string;
  collectionFieldUiTab?: string;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    PopularityScoresService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => PopularityScoresPlugin.config,
    },
  ],
  controllers: [OrderByPopularityController],
  shopApiExtensions: {
    schema: gql`
      type ExampleType {
        name: String
      }
    `,
  },
  configuration: (config) => {
    config.customFields.Product.push({
      name: 'popularityScore',
      type: 'int',
      defaultValue: 0,
      ui: {
        tab: PopularityScoresPlugin?.config?.productFieldUiTab,
      },
      label: [{ languageCode: LanguageCode.en, value: 'Popularity Score' }],
    });
    config.customFields.Collection.push({
      name: 'popularityScore',
      type: 'int',
      defaultValue: 0,
      ui: {
        tab: PopularityScoresPlugin?.config?.collectionFieldUiTab,
      },
      label: [{ languageCode: LanguageCode.en, value: 'Popularity Score' }],
    });
    return config;
  },
  compatibility: '>=2.2.0',
})
export class PopularityScoresPlugin {
  static config: PopularityScoresPluginConfig;

  static init(
    config: PopularityScoresPluginConfig
  ): Type<PopularityScoresPlugin> {
    this.config = config;
    if (!this.config?.chunkSize) {
      this.config.chunkSize = 100;
    }
    return this;
  }
}
