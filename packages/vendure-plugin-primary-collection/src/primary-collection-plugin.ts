import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { gql } from 'graphql-tag';
import { PrimaryCollectionResolver } from './primary-collection.resolver';

@VendurePlugin({
  imports: [PluginCommonModule],
  shopApiExtensions: {
    schema: gql`
      extend type Product {
        primaryCollection: Collection
      }
    `,
    resolvers: [PrimaryCollectionResolver],
  },
  compatibility: '^2.0.0',
})
export class PrimaryCollectionPlugin {}
