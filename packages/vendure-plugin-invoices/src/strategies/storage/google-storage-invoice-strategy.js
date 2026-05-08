'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.GoogleStorageInvoiceStrategy = void 0;
const core_1 = require('@vendure/core');
const fs_1 = require('fs');
const file_util_1 = require('../../util/file.util');
/**
 * @description
 * Store invoice files in a Google Cloud Storage bucket
 */
class GoogleStorageInvoiceStrategy {
  constructor(config) {
    this.config = config;
    this.bucketName = config.bucketName;
  }
  async init() {
    try {
      const storage = await Promise.resolve().then(() =>
        __importStar(require('@google-cloud/storage'))
      );
      this.storage = this.config.storageOptions
        ? new storage.Storage(this.config.storageOptions)
        : new storage.Storage();
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    } catch (err) {
      core_1.Logger.error(
        `Could not find the "@google-cloud/storage" package. Make sure it is installed`,
        GoogleStorageInvoiceStrategy.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        err.stack
      );
    }
  }
  async getPublicUrl(invoice) {
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
  async save(tmpFile, invoiceNumber, channelToken, isCreditInvoice) {
    let filename = `${invoiceNumber}.pdf`;
    if (isCreditInvoice) {
      filename = `${invoiceNumber}-credit.pdf`;
    }
    const fullPath = `${channelToken}/${filename}`;
    await this.storage.bucket(this.bucketName).upload(tmpFile, {
      destination: fullPath,
    });
    (0, file_util_1.safeRemove)(tmpFile);
    return fullPath;
  }
  async streamMultiple(invoices, res) {
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `inline; filename="invoices-${invoices.length}.zip"`,
    });
    const files = await Promise.all(
      invoices.map(async (invoice) => {
        const tmpFile = await (0, file_util_1.createTempFile)('.pdf');
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
    const zipFile = await (0, file_util_1.zipFiles)(files);
    return (0, fs_1.createReadStream)(zipFile);
  }
}
exports.GoogleStorageInvoiceStrategy = GoogleStorageInvoiceStrategy;
