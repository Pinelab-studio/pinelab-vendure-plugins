import { PermissionDefinition } from '@vendure/core';

export const orderExportPermission = new PermissionDefinition({
  name: 'ExportOrders',
  description: 'Allows administrator to export orders',
});
export * from './order-export.plugin';
export * from './api/export-strategy';
