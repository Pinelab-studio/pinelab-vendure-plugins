'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.LocalFileStrategy = void 0;
const fs_1 = require('fs');
const file_util_1 = require('../../util/file.util');
/**
 * @description
 * This default storage strategy stores file on local disk with sync operations
 */
class LocalFileStrategy {
  constructor() {
    this.invoiceDir = 'invoices';
  }
  async init() {}
  async save(tmpFile, invoiceNumber, channelToken, isCreditInvoice) {
    if (!(await (0, file_util_1.exists)(this.invoiceDir))) {
      await fs_1.promises.mkdir(this.invoiceDir);
    }
    let name = `${invoiceNumber}.pdf`;
    if (isCreditInvoice) {
      name = `${invoiceNumber}-credit.pdf`;
    }
    const newPath = `${this.invoiceDir}/${name}`;
    await fs_1.promises.rename(tmpFile, newPath);
    return newPath;
  }
  async streamMultiple(invoices, res) {
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `inline; filename="invoices-${invoices.length}.zip"`,
    });
    const zippableFiles = invoices.map((invoice) => ({
      path: invoice.storageReference,
      name: invoice.invoiceNumber + '.pdf',
    }));
    const zipFile = await (0, file_util_1.zipFiles)(zippableFiles);
    return (0, fs_1.createReadStream)(zipFile);
  }
  streamFile(invoice, res) {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
    });
    return (0, fs_1.createReadStream)(invoice.storageReference);
  }
}
exports.LocalFileStrategy = LocalFileStrategy;
