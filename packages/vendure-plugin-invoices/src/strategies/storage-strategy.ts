import { Response } from 'express';
import { ReadStream } from 'fs';
import { InvoiceEntity } from '../entities/invoice.entity';

/**
 * @description
 * Strategy for storing and retrieving invoice files
 */
export type StorageStrategy = RemoteStorageStrategy | LocalStorageStrategy;

interface BaseStorageStrategy {
  /**
   * @description
   * Store the given file where you want and return a reference
   * that can later be used to retrieve the same file
   * You receive the path to the created
   * tmpFile
   */
  save(
    tmpFile: string,
    invoiceNumber: number,
    channelToken: string,
    isCreditInvoice: boolean
  ): Promise<string>;

  init(): Promise<void>;

  /**
   * @description
   * Bundles multiple files by invoiceNumbers in zipFile for download via admin UI
   * Will only be called by admins
   */
  streamMultiple(invoices: InvoiceEntity[], res: Response): Promise<ReadStream>;
}

export interface RemoteStorageStrategy extends BaseStorageStrategy {
  /**
   * @description
   * Returns a download link where  user can download the Invoice file.
   * For example an downloadLink to a Google storage bucket
   * or Amazon S3 instance
   */
  getPublicUrl(invoice: InvoiceEntity): Promise<string>;
}

export interface LocalStorageStrategy extends BaseStorageStrategy {
  /**
   * @description
   * Stream the file via the server to the client.
   * Use res.set() to set content-type
   * and content-disposition
   */
  streamFile(invoice: InvoiceEntity, res: Response): Promise<ReadStream>;
}
