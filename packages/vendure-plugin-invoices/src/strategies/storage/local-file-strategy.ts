import { Response } from 'express';
import { createReadStream, promises as fs, ReadStream } from 'fs';
import { InvoiceEntity } from '../../entities/invoice.entity';
import { exists, zipFiles, ZippableFile } from '../../util/file.util';
import { LocalStorageStrategy } from './storage-strategy';

/**
 * @description
 * This default storage strategy stores file on local disk with sync operations
 */
export class LocalFileStrategy implements LocalStorageStrategy {
  invoiceDir = 'invoices';

  async init(): Promise<void> {}

  async save(
    tmpFile: string,
    invoiceNumber: number,
    channelToken: string,
    isCreditInvoice: boolean
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

  async streamMultiple(
    invoices: InvoiceEntity[],
    res: Response
  ): Promise<ReadStream> {
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

  streamFile(invoice: InvoiceEntity, res: Response): ReadStream {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
    });
    return createReadStream(invoice.storageReference);
  }
}
