import { PermissionDefinition } from '@vendure/core';

export const fullSyncPermission = new PermissionDefinition({
  name: 'QLSFullSync',
  description: 'Allows triggering QLS full sync',
});
