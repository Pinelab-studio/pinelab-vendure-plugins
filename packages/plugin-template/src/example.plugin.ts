import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { gql } from 'graphql-tag';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [],
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
export class ExamplePlugin {}
