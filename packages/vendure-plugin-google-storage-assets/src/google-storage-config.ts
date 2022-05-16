import type { StorageOptions } from '@google-cloud/storage';
export interface GoogleStorageConfig {
  bucketName: string;
  thumbnails?: {
    height: number;
    width: number;
  };
  storageOptions?: StorageOptions;
  /**
   * Proxy images through the asset-server for admin UI, so that images are resized for admin UI.
   */
  useAssetServerForAdminUi?: boolean;
}
