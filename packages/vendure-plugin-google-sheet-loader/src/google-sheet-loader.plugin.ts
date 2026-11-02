import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { adminApiExtention } from './api/api-extensions';
import { GoogleSheetDataLoaderResolver } from './api/google-sheet-data-loader.resolver';
import { GOOGLE_SHEET_PLUGIN_OPTIONS } from './constants';
import { GoogleSheetService } from './services/google-sheet.service';
import { GoogleSheetLoaderPluginOptions } from './types';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: GOOGLE_SHEET_PLUGIN_OPTIONS,
      useFactory: () => GoogleSheetLoaderPlugin.options,
    },
    GoogleSheetService,
  ],
  adminApiExtensions: {
    schema: adminApiExtention,
    resolvers: [GoogleSheetDataLoaderResolver],
  },
  dashboard: './dashboard/index.tsx',
  compatibility: '^3.0.0',
})
export class GoogleSheetLoaderPlugin {
  static options: GoogleSheetLoaderPluginOptions;

  static init(
    options: GoogleSheetLoaderPluginOptions,
  ): Type<GoogleSheetLoaderPlugin> {
    GoogleSheetLoaderPlugin.options = options;
    return GoogleSheetLoaderPlugin;
  }
}
