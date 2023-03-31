import { PermissionDefinition } from '@vendure/core';

export const permission = new PermissionDefinition({
  name: 'Picqer',
  description: 'Allows setting Picqer config and triggering Picqer full sync',
});

export * from './picqer.plugin';

//TODO export
