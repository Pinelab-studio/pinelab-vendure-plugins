import { PermissionDefinition } from '@vendure/core';

export const orderExportPermission = new PermissionDefinition({
  name: 'ExportOrders',
  description: 'Allows exporting orders via order-export plugin',
});
export * from './order-export.plugin';
export * from './api/order-export-strategy';
export * from './ui/generated/graphql';
