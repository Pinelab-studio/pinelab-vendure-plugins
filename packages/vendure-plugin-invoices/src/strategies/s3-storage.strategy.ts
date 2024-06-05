import { Logger } from '@vendure/core';
import { Response } from 'express';
import { readFile, writeFile } from 'fs/promises';
import { InvoiceEntity } from '../entities/invoice.entity';
import {
  safeRemove,
  ZippableFile,
  createTempFile,
  zipFiles,
} from '../util/file.util';
import { createReadStream, ReadStream } from 'fs';
import { RemoteStorageStrategy } from './storage-strategy';

export interface Config {
  expiresInSeconds: number;
  bucket: string;
  region?: string;
  endpoint?: any;
  s3ForcePathStyle?: boolean;
  credentials?: any;
  signatureVersion?: string;
}

export class S3StorageStrategy implements RemoteStorageStrategy {
  private s3?: import('aws-sdk').S3;
  private readonly bucket: string;
  private readonly expiresInSeconds: number;
  constructor(private readonly config: Config) {
    this.bucket = config.bucket;
    this.expiresInSeconds = config.expiresInSeconds;
  }

  async init(): Promise<void> {
    try {
      const AWS = await import('aws-sdk');
      this.s3 = new AWS.S3(this.config as any);
    } catch (e: any) {
      Logger.error(
        `Could not find the "aws-sdk" package. Make sure it is installed`,
        S3StorageStrategy.name,
        e.stack
      );
    }
  }

  async getPublicUrl(invoice: InvoiceEntity): Promise<string> {
    return await this.s3!.getSignedUrl('getObject', {
      Key: invoice.storageReference,
      Bucket: this.bucket,
      Expires: this.expiresInSeconds,
    });
  }

  async save(
    tmpFile: string,
    invoiceNumber: number,
    channelToken: string,
    isCreditInvoice: boolean
  ): Promise<string> {
    let filename = `${invoiceNumber}.pdf`;
    if (isCreditInvoice) {
      filename = `${invoiceNumber}-credit.pdf`;
    }
    const Key: string = `invoices/${channelToken}/${filename}`;
    await this.s3!.upload({
      Bucket: this.bucket,
      Key,
      Body: await readFile(tmpFile),
      ContentType: 'application/pdf',
      ContentDisposition: 'inline',
    }).promise();
    safeRemove(tmpFile);
    return Key;
  }

  async streamMultiple(
    invoices: InvoiceEntity[],
    res: Response<any, Record<string, any>>
  ): Promise<ReadStream> {
    const files: ZippableFile[] = await Promise.all(
      invoices.map(async (invoice) => {
        const tmpFile = await createTempFile('.pdf');
        const object = await this.s3!.getObject({
          Bucket: this.bucket,
          Key: invoice.storageReference,
        }).promise();
        await writeFile(tmpFile, object.Body?.toString()!);
        return {
          path: tmpFile,
          name: invoice.invoiceNumber + '.pdf',
        };
      })
    );
    const zipFile = await zipFiles(files);
    return createReadStream(zipFile);
  }
}
