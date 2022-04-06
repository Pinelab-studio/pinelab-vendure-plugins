import type { StorageOptions } from '@google-cloud/storage';
export interface GoogleStorageConfig {
  bucketName: string;
  thumbnails?: {
    height: number;
    width: number;
  };
  storageOptions?: StorageOptions;
}
