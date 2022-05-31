import path from 'path';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';

export const completeOrderButton: AdminUiExtension = {
  extensionPath: path.join(__dirname, 'ui'),
  ngModules: [
    {
      type: 'shared',
      ngModuleFileName: 'complete-order-button.module.ts',
      ngModuleName: 'CompleteOrderButtonModule',
    },
  ],
};

export const cancelOrderButton: AdminUiExtension = {
  extensionPath: path.join(__dirname, 'ui'),
  ngModules: [
    {
      type: 'shared',
      ngModuleFileName: 'cancel-order-button.module.ts',
      ngModuleName: 'CancelOrderButtonModule',
    },
  ],
};
