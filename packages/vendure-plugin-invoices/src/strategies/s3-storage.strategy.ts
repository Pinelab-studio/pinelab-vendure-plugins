import { Logger } from '@vendure/core';
import { readFile } from 'fs/promises';
import { InvoiceEntity } from '../entities/invoice.entity';
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
    return Key;
  }
}
