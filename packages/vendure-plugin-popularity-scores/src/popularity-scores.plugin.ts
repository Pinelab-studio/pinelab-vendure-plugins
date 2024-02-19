import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
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
    });
    config.customFields.Collection.push({
      name: 'popularityScore',
      type: 'int',
      defaultValue: 0,
    });
    return config;
  },
  compatibility: '^2.0.0',
})
export class PopularityScoresPlugin {
  static config: PopularityScoresPluginConfig;

  static init(
    config: PopularityScoresPluginConfig,
  ): Type<PopularityScoresPlugin> {
    this.config = config;
    if (!this.config?.chunkSize) {
      this.config.chunkSize = 100;
    }
    return this;
  }
}
