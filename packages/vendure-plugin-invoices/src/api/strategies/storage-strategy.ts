import {
  createReadStream,
  existsSync,
  mkdirSync,
  ReadStream,
  renameSync,
} from 'fs';
import { Response } from 'express';
import { InvoiceEntity } from '../entities/invoice.entity';
import * as path from 'path';

/**
 * The invoice plugin will first try to use getPublicUrl, when that function is
 * not implemented, it will try to stream the file to the client
 */
export type StorageStrategy = RemoteStorageStrategy | LocalStorageStrategy;

interface BaseStorageStrategy {
  /**
   * Store the given file where you want and return a reference
   * that can later be used to retrieve the same file
   * You receive the path to the created
   * tmpFile
   */
  save(tmpFile: string, invoiceNumber: number): Promise<string>;
}

export interface RemoteStorageStrategy extends BaseStorageStrategy {
  /**
   * Returns a downloadlink where  user can download the Invoice file.
   * For example an downloadLink to a Google storage bucket
   * or Amazon S3 instance
   */
  getPublicUrl(invoice: InvoiceEntity): Promise<string>;
}

export interface LocalStorageStrategy extends BaseStorageStrategy {
  /**
   * Stream the file via the server to the client.
   * Use res.set() to set content-type
   * and content-disposition
   */
  streamFile(invoice: InvoiceEntity, res: Response): Promise<ReadStream>;
}

/**
 * Default storage strategy just stores file on local disk with sync operations
 * Use this strategy just for testing
 */
export class DefaultStorageStrategy implements LocalStorageStrategy {
  invoiceDir = 'invoices';

  async save(tmpFile: string, invoiceNumber: number) {
    if (!existsSync(this.invoiceDir)) {
      mkdirSync(this.invoiceDir);
    }
    const fileName = path.basename(tmpFile);
    const newPath = `${this.invoiceDir}/${invoiceNumber}-${fileName}`;
    renameSync(tmpFile, newPath);
    return newPath;
  }

  async streamFile(invoice: InvoiceEntity, res: Response) {
    const file = createReadStream(invoice.storageReference);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
    });
    return file;
  }
}
