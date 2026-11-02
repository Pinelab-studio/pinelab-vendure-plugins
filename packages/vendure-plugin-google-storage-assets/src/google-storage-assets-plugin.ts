import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { createAssetSchema } from './api/api-extensions';
import { GoogleStorageAssetResolver } from './api/google-storage-asset.resolver';
import { googleStorageAssetConfig } from './config';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { PresetService } from './services/preset-service';
import { GoogleStorageAssetConfig } from './types';

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
  /** Return the shared configuration used by storage strategies. */
  static get config(): GoogleStorageAssetConfig {
    const config = googleStorageAssetConfig.current;
    if (!config)
      throw new Error('GoogleStorageAssetsPlugin is not initialized');
    return config;
  }

  /** Update the shared configuration without importing the decorated plugin. */
  static set config(config: GoogleStorageAssetConfig) {
    googleStorageAssetConfig.current = config;
  }

  static init(
    config: GoogleStorageAssetConfig,
  ): typeof GoogleStorageAssetsPlugin {
    GoogleStorageAssetsPlugin.config = config;
    return GoogleStorageAssetsPlugin;
  }
}
