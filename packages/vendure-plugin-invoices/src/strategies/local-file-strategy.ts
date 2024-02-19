import { Response } from 'express';
import { createReadStream, promises as fs, ReadStream } from 'fs';
import path from 'path';
import { InvoiceEntity } from '../entities/invoice.entity';
import { exists } from '../util/file.util';
import { LocalStorageStrategy } from './storage-strategy';

/**
 * Default storage strategy just stores file on local disk with sync operations
 * Use this strategy just for testing
 */
export class LocalFileStrategy implements LocalStorageStrategy {
  invoiceDir = 'invoices';

  async init(): Promise<void> {}

  async save(
    tmpFile: string,
    invoiceNumber: number,
    channelToken: string,
    isCreditInvoice: boolean,
  ) {
    if (!(await exists(this.invoiceDir))) {
      await fs.mkdir(this.invoiceDir);
    }
    let name = `${invoiceNumber}.pdf`;
    if (isCreditInvoice) {
      name = `${invoiceNumber}-credit.pdf`;
    }
    const newPath = `${this.invoiceDir}/${name}`;
    await fs.rename(tmpFile, newPath);
    return newPath;
  }

  async streamFile(invoice: InvoiceEntity, res: Response): Promise<ReadStream> {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
    });
    return createReadStream(invoice.storageReference);
  }
}
