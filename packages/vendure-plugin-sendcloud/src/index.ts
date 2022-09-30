import { PermissionDefinition } from '@vendure/core';

export const sendcloudPermission = new PermissionDefinition({
  name: 'SetSendCloudConfig',
  description: 'Allows setting SendCloud configuration',
});

export * from './sendcloud.plugin';
export * from './api/sendcloud.handler';
export * from './api/additional-parcel-input-items';
export * from './api/types/sendcloud.types';
export * from './api/types/sendcloud-api.types';
