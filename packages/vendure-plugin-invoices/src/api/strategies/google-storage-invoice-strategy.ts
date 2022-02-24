import { RemoteStorageStrategy } from './storage-strategy';
import { Response } from 'express';
import { InvoiceEntity } from '../entities/invoice.entity';
import { createReadStream, ReadStream } from 'fs';
import { Storage, StorageOptions } from '@google-cloud/storage';
import path from 'path';
import { createTempFile, zipFiles, ZippableFile } from '../file.util';

export class YourRemoteStrategy implements RemoteStorageStrategy {
  async save(
    tmpFile: string,
    invoiceNumber: number,
    channelToken: string
  ): Promise<string> {
    // Save the invoice in your favorite cloud storage. The string you return will be saved as unique reference to your invoice.
    // You should be able to retrieve the file later with just the unique reference
    return 'unique-reference';
  }

  async getPublicUrl(invoice: InvoiceEntity): Promise<string> {
    // Most cloud based storages have the ability to generate a signed URL, which is available for X amount of time.
    // This way the downloading of invoices does not go through the vendure service
    return 'https://your-signed-url/invoice.pdf';
  }

  async streamMultiple(
    invoices: InvoiceEntity[],
    res: Response
  ): Promise<ReadStream> {
    // zip files and return stream. Can only be used by admins
    return createReadStream('your/zip/file.zip');
  }
}
