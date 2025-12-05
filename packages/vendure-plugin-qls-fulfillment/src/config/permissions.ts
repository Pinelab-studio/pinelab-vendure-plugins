import { PermissionDefinition } from '@vendure/core';

export const qlsFullSyncPermission = new PermissionDefinition({
  name: 'QLSFullSync',
  description: 'Allows triggering QLS full sync',
});
export const qlsPushOrderPermission = new PermissionDefinition({
  name: 'QLSPushOrder',
  description: 'Allows pushing orders to QLS',
});
