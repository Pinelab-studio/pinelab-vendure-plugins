import { PermissionDefinition } from '@vendure/core';

export const sendcloudPermission = new PermissionDefinition({
  name: 'SetSendCloudConfig',
  description: 'Allows setting SendCloud configuration',
});

export * from './sendcloud.plugin';
export * from './types/sendcloud-api-input.types';
export * from './types/sendcloud-options';
export * from './types/sendcloud-parcel-status';
export * from './types/sendcloud-api-response.types';
