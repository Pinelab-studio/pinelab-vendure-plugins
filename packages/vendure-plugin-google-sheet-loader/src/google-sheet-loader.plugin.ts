import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
import { GOOGLE_SHEET_PLUGIN_OPTIONS } from './constants';
import { GoogleSheetLoaderPluginOptions } from './types';
import { adminApiExtention } from './api/api-extensions';
import { GoogleSheetDataLoaderResolver } from './api/google-sheet-data-loader.resolver';
import { GoogleSheetService } from './services/google-sheet.service';

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
  compatibility: '^3.0.0',
})
export class GoogleSheetLoaderPlugin {
  static options: GoogleSheetLoaderPluginOptions;

  static init(
    options: GoogleSheetLoaderPluginOptions
  ): Type<GoogleSheetLoaderPlugin> {
    this.options = options;
    return GoogleSheetLoaderPlugin;
  }

  static ui: AdminUiExtension = {
    id: 'google-sheet-loader-ui',
    extensionPath: path.join(__dirname, 'ui'),
    providers: ['providers.ts'],
  };
}
