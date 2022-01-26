import { PermissionDefinition } from '@vendure/core';

export const myparcelPermission = new PermissionDefinition({
  name: 'SetMyparcelConfig',
  description: 'Allows setting MyParcel configurations',
});
export * from './api/myparcel.handler';
export * from './myparcel.plugin';
