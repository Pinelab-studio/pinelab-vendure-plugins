import * as tmp from 'tmp';

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
