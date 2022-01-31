import { PermissionDefinition } from '@vendure/core';

export const goedgepicktPermission = new PermissionDefinition({
  name: 'SetGoedgepicktConfig',
  description: 'Allows setting Goedgepickt configurations',
});
export * from './api/goedgepickt.types';
export * from './ui/generated/graphql';
export * from './goedgepickt.plugin';
export * from './api/goedgepickt.handler';
