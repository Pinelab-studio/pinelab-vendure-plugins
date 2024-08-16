import { Logger } from '@vendure/core';
import { readFile, writeFile } from 'fs/promises';
import { InvoiceEntity } from '../../entities/invoice.entity';
import {
  safeRemove,
  ZippableFile,
  createTempFile,
  zipFiles,
} from '../../util/file.util';
import { createReadStream, ReadStream } from 'fs';
import { RemoteStorageStrategy } from './storage-strategy';

export interface Config {
  expiresInSeconds: number;
  bucket: string;
  region?: string;
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  endpoint?: any;
  s3ForcePathStyle?: boolean;
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  credentials?: any;
  signatureVersion?: string;
}

/**
 * @description
 * Store invoice files in an Amazon S3 bucket
 */
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      this.s3 = new AWS.S3(this.config as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      Logger.error(
        `Could not find the "aws-sdk" package. Make sure it is installed`,
        S3StorageStrategy.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        JSON.stringify(e.stack)
      );
    }
  }

  getPublicUrl(invoice: InvoiceEntity): string {
    return this.s3!.getSignedUrl('getObject', {
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

  async streamMultiple(invoices: InvoiceEntity[]): Promise<ReadStream> {
    const files: ZippableFile[] = await Promise.all(
      invoices.map(async (invoice) => {
        const tmpFile = await createTempFile('.pdf');
        const object = await this.s3!.getObject({
          Bucket: this.bucket,
          Key: invoice.storageReference,
        }).promise();
        await writeFile(tmpFile, object.Body?.toString() as string);
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
