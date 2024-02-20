import fs from 'fs';
import path from 'path';
import {
  AdminUiExtension,
  compileUiExtensions,
} from '@vendure/ui-devkit/compiler';
export default async function getFilesInAdminUiFolder(
  dirname: string,
  uiExtension: AdminUiExtension,
): Promise<string[]> {
  fs.rmSync(path.join(dirname, '__admin-ui'), {
    recursive: true,
    force: true,
  });
  await compileUiExtensions({
    outputPath: path.join(dirname, '__admin-ui'),
    extensions: [uiExtension],
  }).compile?.();
  return fs.readdirSync(path.join(dirname, '__admin-ui/dist'));
}
