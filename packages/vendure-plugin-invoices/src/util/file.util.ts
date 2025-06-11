import { Logger } from '@vendure/core';
import fs from 'fs/promises';
import * as tmp from 'tmp';
import { loggerCtx } from '../constants';

/* eslint-disable @typescript-eslint/no-require-imports */
import AdmZip = require('adm-zip');

export async function createTempFile(postfix: string): Promise<string> {
  return new Promise((resolve, reject) => {
    tmp.file({ postfix }, (err, path) => {
      if (err) {
        reject(err);
      } else {
        resolve(path);
      }
    });
  });
}

export interface ZippableFile {
  name: string;
  path: string;
}

export async function exists(path: string): Promise<boolean> {
  let exists = false;
  try {
    await fs.access(path);
    exists = true;
  } catch {
    exists = false;
  }
  return exists;
}

/**
 * Attempt deletion of file, but swallow any errors.
 */
export function safeRemove(path: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fs.unlink(path).catch((err: any) => {
    Logger.error(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      `Could not remove file ${path}: ${err?.message}`,
      loggerCtx,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      JSON.stringify(err?.stack)
    );
  });
}

export async function zipFiles(files: ZippableFile[]): Promise<string> {
  const zip = new AdmZip();
  for (const file of files) {
    zip.addLocalFile(file.path, undefined, file.name);
  }
  const tmpFilePath = await createTempFile('.zip');
  zip.writeZip(tmpFilePath);
  return tmpFilePath;
}
