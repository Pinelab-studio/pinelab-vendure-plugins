import * as tmp from 'tmp';
import AdmZip = require('adm-zip');
import fs from 'fs/promises';
import { Logger } from '@vendure/core';
import { loggerCtx } from '../constants';

export interface ZippableFile {
  name: string;
  path: string;
}

export async function createTempFile(postfix: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    tmp.file({ postfix }, (err, path, fd, cleanupCallback) => {
      if (err) {
        reject(err);
      } else {
        resolve(path);
      }
    });
  });
}

/**
 * Try to remove file without throwing an error
 */
export function safeRemoveFile(filePath: string): void {
  fs.unlink(filePath).catch((e) => {
    Logger.warn(`Failed to delete file ${filePath}`, loggerCtx);
  });
}

export async function zipFiles(files: ZippableFile[]): Promise<string> {
  const zip = new AdmZip();
  for (const file of files) {
    zip.addLocalFile(file.path, undefined, file.name);
  }
  const tmpFilePath = await createTempFile('.zip');
  await zip.writeZip(tmpFilePath);
  return tmpFilePath;
}
