import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { gql } from 'graphql-tag';
import { SortService } from './sort.service';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [SortService],
  shopApiExtensions: {
    schema: gql`
      type ExampleType {
        name: String
      }
    `,
  },
  configuration: (config) => {
    return config;
  },
})
export class SortByPopularityPlugin {}
