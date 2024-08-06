import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { assetThumbnailSchema } from './asset-thumbnail.schema';
import { AssetThumbnailResolvers } from './asset-thumbnail.resolvers';

@VendurePlugin({
  imports: [PluginCommonModule],
  shopApiExtensions: {
    schema: assetThumbnailSchema,
    resolvers: [AssetThumbnailResolvers],
  },
  adminApiExtensions: {
    schema: assetThumbnailSchema,
    resolvers: [AssetThumbnailResolvers],
  },
  compatibility: '>=2.2.0',
})
export class GoogleStoragePlugin {
  context = 'GoogleStoragePlugin';
}
