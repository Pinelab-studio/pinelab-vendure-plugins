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
          { languageCode: LanguageCode.en, value: 'Show On Product Detail' },
        ],
        type: 'boolean',
        nullable: true,
        public: false,
      },
      {
        name: 'showOnProductDetailIf',
        label: [
          { languageCode: LanguageCode.en, value: 'Show On Product Detail If' },
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
export class SelectableFacetsPlugin {
  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    providers: ['providers.ts'],
  };
}
