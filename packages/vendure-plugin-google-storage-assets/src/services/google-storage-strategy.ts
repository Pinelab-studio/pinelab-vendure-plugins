/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { AssetStorageStrategy } from '@vendure/core';
import { Storage } from '@google-cloud/storage';
import { Request } from 'express';
import { Stream } from 'stream';
import * as tmp from 'tmp';
import * as fs from 'fs';
import { GoogleStorageAssetsPlugin } from '../google-storage-assets-plugin';

export class GoogleStorageStrategy implements AssetStorageStrategy {
  storage: Storage;
  urlPrefix = 'https://storage.googleapis.com';
  bucketName: string;
  readonly useAssetServerForAdminUi: boolean;

  constructor() {
    const config = GoogleStorageAssetsPlugin?.config;
    if (!config) {
      throw new Error(
        'GoogleStorageAssetsPlugin.config is not set. Did you include the "GoogleStorageAssetsPlugin" in your Vendure config?'
      );
    }
    this.bucketName = config.bucketName;
    this.useAssetServerForAdminUi =
      config.useAssetServerForAdminUi === undefined
        ? true
        : config.useAssetServerForAdminUi;
    this.storage = new Storage(config.storageOptions ?? {});
  }

  toAbsoluteUrl(request: Request | undefined, identifier: string): string {
    // Vendure v3 has an extra 'default' property before we can access the apiType
    const apiType =
      (request as any)?.vendureRequestContext?.default?._apiType ||
      (request as any)?.vendureRequestContext?._apiType;
    if (this.useAssetServerForAdminUi && apiType === 'admin') {
      // go via assetServer if admin
      return `${request!.protocol}://${request!.get(
        'host'
      )}/assets/${identifier}`;
    }
    return `${this.urlPrefix}/${this.bucketName}/${identifier}`;
  }

  async deleteFile(identifier: string): Promise<void> {
    await this.storage.bucket(this.bucketName).file(identifier).delete();
  }

  async fileExists(fileName: string): Promise<boolean> {
    const [exists] = await this.storage
      .bucket(this.bucketName)
      .file(fileName)
      .exists();
    return exists;
  }

  async readFileToBuffer(identifier: string): Promise<Buffer> {
    const tmpFile = await this.downloadRemoteToLocalTmpFile(identifier);
    return fs.readFileSync(tmpFile);
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- parent interface requires promise
  async readFileToStream(identifier: string): Promise<Stream> {
    if (identifier?.startsWith('/')) {
      identifier = identifier.replace('/', '');
    }
    return this.storage
      .bucket(this.bucketName)
      .file(identifier)
      .createReadStream();
  }

  async writeFileFromBuffer(fileName: string, data: Buffer): Promise<string> {
    const tmpFile = tmp.fileSync();
    fs.writeFileSync(tmpFile.name, data);
    await this.storage.bucket(this.bucketName).upload(tmpFile.name, {
      destination: fileName,
    });
    return fileName;
  }

  async writeFileFromStream(fileName: string, data: Stream): Promise<string> {
    const blob = this.storage.bucket(this.bucketName).file(fileName);
    const uploadStream = blob.createWriteStream();
    await this.streamToPromise(data.pipe(uploadStream));
    return fileName;
  }

  streamToPromise(stream: Stream): Promise<void> {
    return new Promise(function (resolve, reject) {
      stream.on('end', resolve);
      stream.on('finish', resolve);
      stream.on('close', resolve);
      stream.on('error', reject);
    });
  }

  /**
   * Download a remote file to a local temporary file
   */
  async downloadRemoteToLocalTmpFile(identifier: string): Promise<string> {
    if (identifier?.startsWith('/')) {
      identifier = identifier.replace('/', '');
    }
    const tmpFile = tmp.fileSync();
    await this.storage
      .bucket(this.bucketName)
      .file(identifier)
      .download({ destination: tmpFile.name });
    return tmpFile.name;
  }
}
