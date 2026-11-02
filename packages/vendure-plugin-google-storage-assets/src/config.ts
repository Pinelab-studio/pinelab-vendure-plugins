import type { GoogleStorageAssetConfig } from './types';

// Shared independently of the plugin decorator to avoid circular provider imports.
export const googleStorageAssetConfig: { current?: GoogleStorageAssetConfig } =
  {};
