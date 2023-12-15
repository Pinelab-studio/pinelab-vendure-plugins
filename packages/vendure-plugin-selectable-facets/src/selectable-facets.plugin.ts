import {
  FacetValue,
  LanguageCode,
  PluginCommonModule,
  VendurePlugin,
} from '@vendure/core';
import { adminApiExtensions } from './api/schema.graphql';
import { ShowOnProductDetailFacetsService } from './api/show-on-product-detail-facets.service';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { ShowOnProductDetailFacetsResolver } from './api/show-on-product-detail-facets.resolver';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [ShowOnProductDetailFacetsService],
  configuration: (config) => {
    config.customFields.Facet.push(
      {
        name: 'showOnProductDetail',
        label: [
          {
            languageCode: LanguageCode.en,
            value: 'Show on Product Detail Page',
          },
        ],
        type: 'boolean',
        nullable: true,
        public: false,
      },
      {
        name: 'showOnProductDetailIf',
        label: [
          {
            languageCode: LanguageCode.en,
            value: 'Show on Product Detail Page depending on',
          },
        ],
        type: 'relation',
        entity: FacetValue,
        list: true,
        public: false,
        ui: { component: 'facet-value-form-input' },
      }
    );
    return config;
  },
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [ShowOnProductDetailFacetsResolver],
  },
})
export class SelectableFacetsPlugin {
  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    providers: ['providers.ts'],
  };
}
