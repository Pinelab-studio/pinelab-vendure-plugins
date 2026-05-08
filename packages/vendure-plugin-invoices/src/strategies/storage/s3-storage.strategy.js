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
exports.S3StorageStrategy = void 0;
const core_1 = require('@vendure/core');
const promises_1 = require('fs/promises');
const file_util_1 = require('../../util/file.util');
const fs_1 = require('fs');
/**
 * @description
 * Store invoice files in an Amazon S3 bucket
 */
class S3StorageStrategy {
  constructor(config) {
    this.config = config;
    this.bucket = config.bucket;
    this.expiresInSeconds = config.expiresInSeconds;
  }
  async init() {
    try {
      const AWS = await Promise.resolve().then(() =>
        __importStar(require('aws-sdk'))
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      this.s3 = new AWS.S3(this.config);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e) {
      core_1.Logger.error(
        `Could not find the "aws-sdk" package. Make sure it is installed`,
        S3StorageStrategy.name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        JSON.stringify(e.stack)
      );
    }
  }
  getPublicUrl(invoice) {
    return this.s3.getSignedUrl('getObject', {
      Key: invoice.storageReference,
      Bucket: this.bucket,
      Expires: this.expiresInSeconds,
    });
  }
  async save(tmpFile, invoiceNumber, channelToken, isCreditInvoice) {
    let filename = `${invoiceNumber}.pdf`;
    if (isCreditInvoice) {
      filename = `${invoiceNumber}-credit.pdf`;
    }
    const Key = `invoices/${channelToken}/${filename}`;
    await this.s3
      .upload({
        Bucket: this.bucket,
        Key,
        Body: await (0, promises_1.readFile)(tmpFile),
        ContentType: 'application/pdf',
        ContentDisposition: 'inline',
      })
      .promise();
    (0, file_util_1.safeRemove)(tmpFile);
    return Key;
  }
  async streamMultiple(invoices) {
    const files = await Promise.all(
      invoices.map(async (invoice) => {
        const tmpFile = await (0, file_util_1.createTempFile)('.pdf');
        const object = await this.s3
          .getObject({
            Bucket: this.bucket,
            Key: invoice.storageReference,
          })
          .promise();
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        await (0, promises_1.writeFile)(tmpFile, object.Body?.toString());
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
exports.S3StorageStrategy = S3StorageStrategy;
