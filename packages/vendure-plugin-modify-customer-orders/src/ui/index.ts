import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import path from 'path';
export const convertToDraftButton: AdminUiExtension = {
  extensionPath: path.join(__dirname, ''),
  ngModules: [
    {
      type: 'shared',
      ngModuleFileName: 'convert-to-draft-button.module.ts',
      ngModuleName: 'ConvertToDraftButtonModule',
    },
  ],
};
