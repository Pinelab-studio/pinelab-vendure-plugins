import { promises as fs } from 'fs';
import * as tmp from 'tmp';

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
