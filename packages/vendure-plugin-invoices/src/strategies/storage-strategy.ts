import { Response } from 'express';
import { ReadStream } from 'fs';
import { InvoiceEntity } from '../entities/invoice.entity';

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
  save(
    tmpFile: string,
    invoiceNumber: number,
    channelToken: string
  ): Promise<string>;

  /**
   * Bundles multiple files by invoiceNumbers in zipFile for download via admin UI
   * Will only be called by admins
   */
  streamMultiple(invoices: InvoiceEntity[], res: Response): Promise<ReadStream>;

  init(): Promise<void>;
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
