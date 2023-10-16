import {
  Collection,
  LanguageCode,
  PluginCommonModule,
  RuntimeVendureConfig,
  VendurePlugin,
} from '@vendure/core';
import { gql } from 'graphql-tag';
import { PrimaryCollectionResolver } from './api/primary-collection.resolver';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { PrimaryCollectionHelperService } from './api/primary-collections-helper.service';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [PrimaryCollectionHelperService],
  shopApiExtensions: {
    schema: gql`
      extend type Product {
        primaryCollection: Collection
      }
    `,
    resolvers: [PrimaryCollectionResolver],
  },
  exports: [PrimaryCollectionHelperService],
  compatibility: '^2.0.0',
  configuration: (config: RuntimeVendureConfig) => {
    config.customFields.Product.push({
      name: 'primaryCollection',
      type: 'relation',
      entity: Collection,
      graphQLType: 'Collection',
      eager: true,
      nullable: true,
      ui: {
        component: 'select-primary-collection',
      },
      label: [{ languageCode: LanguageCode.en, value: 'Primary Collection' }],
    });
    return config;
  },
})
export class PrimaryCollectionPlugin {
  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'shared',
        ngModuleFileName: 'shared.module.ts',
        ngModuleName: 'PrimaryCollectionSharedExtensionModule',
      },
    ],
  };
}
