import * as tmp from 'tmp';
import { promises as fs, createWriteStream, createReadStream } from 'fs';
import AdmZip = require('adm-zip');

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

export interface ZippableFile {
  name: string;
  path: string;
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
