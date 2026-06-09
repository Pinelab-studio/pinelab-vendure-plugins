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
    await fs.copyFile(tmpFile, newPath);
    await fs.unlink(tmpFile);
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
    const zippableFiles: ZippableFile[] = [];
    for (const invoice of invoices) {
      if (!(await exists(invoice.storageReference))) {
        throw new Error(
          `Invoice file not found at path: ${invoice.storageReference}`
        );
      }
      zippableFiles.push({
        path: invoice.storageReference,
        name: invoice.invoiceNumber + '.pdf',
      });
    }
    const zipFile = await zipFiles(zippableFiles);
    const stream = createReadStream(zipFile);
    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).end();
      }
      stream.destroy(err);
    });
    return stream;
  }

  /**
   * Streams a single invoice file to the response.
   * Throws if the file does not exist on disk.
   */
  async streamFile(invoice: InvoiceEntity, res: Response): Promise<ReadStream> {
    const filePath = invoice.storageReference;
    if (!(await exists(filePath))) {
      throw new Error(`Invoice file not found at path: ${filePath}`);
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
    });
    const stream = createReadStream(filePath);
    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).end();
      }
      stream.destroy(err);
    });
    return stream;
  }
}
