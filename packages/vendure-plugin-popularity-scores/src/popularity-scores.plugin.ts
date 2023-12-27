import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { gql } from 'graphql-tag';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { OrderByPopularityController } from './popularity.controller';
import { SortService } from './sort.service';

export interface PopularityScoresPluginConfig {
  /**
   * Prevent unauthenticated requests to the calculation endpoint
   */
  endpointSecret: string;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    SortService,
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
    config: PopularityScoresPluginConfig
  ): Type<PopularityScoresPlugin> {
    this.config = config;
    return this;
  }
}
