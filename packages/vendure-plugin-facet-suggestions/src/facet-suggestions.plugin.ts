import {
  FacetValue,
  LanguageCode,
  PluginCommonModule,
  VendurePlugin,
} from '@vendure/core';
import { adminApiExtensions } from './api/schema.graphql';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { AdminResolver } from './api/admin.resolver';

@VendurePlugin({
  imports: [PluginCommonModule],
  configuration: (config) => {
    config.customFields.Facet.push(
      {
        name: 'showOnProductDetail',
        label: [
          { languageCode: LanguageCode.en, value: 'Show on product detail page' },
        ],
        description: [
          { languageCode: LanguageCode.en, value: 'Always show this facet as suggestion on product detail pages' },
        ],
        type: 'boolean',
        nullable: true,
        public: false,
      },
      {
        name: 'showOnProductDetailIf',
        label: [
          { languageCode: LanguageCode.en, value: 'Show if product has facets' },
        ],
        description: [
          { languageCode: LanguageCode.en, value: 'Show as suggestion on product detail pages when the product has these facets' },
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
    resolvers: [AdminResolver],
  },
})
export class FacetSuggestionsPlugin {
  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    providers: ['providers.ts'],
  };
}
