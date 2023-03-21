import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { gql } from 'graphql-tag';
import { OrderByPopularityController } from './popularity.controller';
import { SortService } from './sort.service';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [SortService],
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
      type: 'float',
      defaultValue: 0.0,
      readonly: true,
    });
    config.customFields.Collection.push({
      name: 'popularityScore',
      type: 'float',
      defaultValue: 0.0,
      readonly: true,
    });
    return config;
  },
})
export class SortByPopularityPlugin {}
