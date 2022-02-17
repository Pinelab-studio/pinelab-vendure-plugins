import { PermissionDefinition } from '@vendure/core';

export const invoicePermission = new PermissionDefinition({
  name: 'AllowInvoicesPermission',
  description: 'Allow this user to enable invoice generation',
});
export * from './invoice.plugin';
