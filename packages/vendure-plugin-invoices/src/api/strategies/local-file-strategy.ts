import { promises as fs, createReadStream } from 'fs';
import path from 'path';
import { InvoiceEntity } from '../entities/invoice.entity';
import { Response } from 'express';
import { LocalStorageStrategy } from './storage-strategy';
import { exists, zipFiles, ZippableFile } from '../file.util';

/**
 * Default storage strategy just stores file on local disk with sync operations
 * Use this strategy just for testing
 */
export class LocalFileStrategy implements LocalStorageStrategy {
  invoiceDir = 'invoices';

  async save(tmpFile: string, invoiceNumber: number) {
    if (!(await exists(this.invoiceDir))) {
      await fs.mkdir(this.invoiceDir);
    }
    const fileName = path.basename(tmpFile);
    const newPath = `${this.invoiceDir}/${invoiceNumber}-${fileName}`;
    await fs.rename(tmpFile, newPath);
    return newPath;
  }

  async streamMultiple(invoices: InvoiceEntity[], res: Response) {
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `inline; filename="invoices-${invoices.length}.zip"`,
    });
    const zippableFiles: ZippableFile[] = invoices.map((invoice) => ({
      path: invoice.storageReference,
      name: invoice.invoiceNumber + '.pdf',
    }));
    const zipFile = await zipFiles(zippableFiles);
    return createReadStream(zipFile);
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
