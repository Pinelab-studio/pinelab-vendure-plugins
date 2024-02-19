import { Logger } from '@vendure/core';
import fs from 'fs/promises';
import * as tmp from 'tmp';
import { loggerCtx } from '../constants';

export async function createTempFile(postfix: string): Promise<string> {
  return new Promise((resolve, reject) => {
    tmp.file({ postfix }, (err, path, fd, cleanupCallback) => {
      if (err) {
        reject(err);
      } else {
        resolve(path);
      }
    });
  });
}

export async function exists(path: string): Promise<boolean> {
  let exists = false;
  try {
    await fs.access(path);
    exists = true;
  } catch (error) {
    exists = false;
  }
  return exists;
}

/**
 * Attempt deletion of file, but swallow any errors.
 */
export function safeRemove(path: string): void {
  fs.unlink(path).catch((err: any | undefined) => {
    Logger.error(
      `Could not remove file ${path}: ${err?.message}`,
      loggerCtx,
      err?.stack,
    );
  });
}
