export interface GoogleStorageConfig {
  bucketName: string;
  thumbnails?: {
    height: number;
    width: number;
  };
}
