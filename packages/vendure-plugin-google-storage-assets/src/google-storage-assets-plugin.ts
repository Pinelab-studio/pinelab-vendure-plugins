import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { createAssetSchema } from './api/api-extensions';
import { GoogleStorageAssetResolver } from './api/google-storage-asset.resolver';
import { GoogleStorageAssetConfig } from './types';
import { PresetService } from './services/preset-service';
import { PLUGIN_INIT_OPTIONS } from './constants';

@VendurePlugin({
  imports: [PluginCommonModule],
  shopApiExtensions: {
    schema: () => createAssetSchema(GoogleStorageAssetsPlugin.config),
    resolvers: [GoogleStorageAssetResolver],
  },
  adminApiExtensions: {
    schema: () => createAssetSchema(GoogleStorageAssetsPlugin.config),
    resolvers: [GoogleStorageAssetResolver],
  },
  compatibility: '>=2.2.0',
  providers: [
    PresetService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => GoogleStorageAssetsPlugin.config,
    },
  ],
  configuration: (config) => {
    config.customFields.Asset.push({
      name: 'presets',
      type: 'text',
      nullable: true,
      public: false,
      internal: true,
    });
    return config;
  },
})
export class GoogleStorageAssetsPlugin {
  static config: GoogleStorageAssetConfig;

  static init(
    config: GoogleStorageAssetConfig
  ): typeof GoogleStorageAssetsPlugin {
    this.config = config;
    return this;
  }
}
