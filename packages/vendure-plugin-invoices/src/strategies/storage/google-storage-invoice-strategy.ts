import { Logger } from '@vendure/core';
import { Response } from 'express';
import { InvoiceEntity } from '../../entities/invoice.entity';
import { createReadStream, ReadStream } from 'fs';
import {
  ZippableFile,
  createTempFile,
  safeRemove,
  zipFiles,
} from '../../util/file.util';
import { RemoteStorageStrategy } from './storage-strategy';

interface GoogleInvoiceConfig {
  bucketName: string;
  /**
   * Passed directly to gclouds node library with new Storage(storageOptions)
   */
  storageOptions?: import('@google-cloud/storage').StorageOptions;
}

/**
 * @description
 * Store invoice files in a Google Cloud Storage bucket
 */
export class GoogleStorageInvoiceStrategy implements RemoteStorageStrategy {
  private storage!: import('@google-cloud/storage').Storage;
  private bucketName: string;

  constructor(private config: GoogleInvoiceConfig) {
    this.bucketName = config.bucketName;
  }

  async init(): Promise<void> {
    try {
      const storage = await import('@google-cloud/storage');
      this.storage = this.config.storageOptions
        ? new storage.Storage(this.config.storageOptions)
        : new storage.Storage();
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    } catch (err: any) {
      Logger.error(
        `Could not find the "@google-cloud/storage" package. Make sure it is installed`,
        GoogleStorageInvoiceStrategy.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        err.stack
      );
    }
  }

  async getPublicUrl(invoice: InvoiceEntity): Promise<string> {
    const [url] = await this.storage
      .bucket(this.bucketName)
      .file(invoice.storageReference)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      });
    return url;
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
    const fullPath = `${channelToken}/${filename}`;
    await this.storage.bucket(this.bucketName).upload(tmpFile, {
      destination: fullPath,
    });
    safeRemove(tmpFile);
    return fullPath;
  }

  async streamMultiple(
    invoices: InvoiceEntity[],
    res: Response
  ): Promise<ReadStream> {
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `inline; filename="invoices-${invoices.length}.zip"`,
    });
    const files: ZippableFile[] = await Promise.all(
      invoices.map(async (invoice) => {
        const tmpFile = await createTempFile('.pdf');
        await this.storage
          .bucket(this.bucketName)
          .file(invoice.storageReference)
          .download({ destination: tmpFile });
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
