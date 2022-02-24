import { PermissionDefinition } from '@vendure/core';

export const invoicePermission = new PermissionDefinition({
  name: 'AllowInvoicesPermission',
  description: 'Allow this user to enable invoice generation',
});
export * from './invoice.plugin';
export * from './api/strategies/storage-strategy';
export * from './api/strategies/data-strategy';
export * from './api/strategies/google-storage-invoice-strategy';
export * from './api/strategies/local-file-strategy';
export * from './api/file.util';
export * from './api/invoice.service';
