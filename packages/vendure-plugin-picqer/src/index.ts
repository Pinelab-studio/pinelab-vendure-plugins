import { PermissionDefinition } from '@vendure/core';

export const permission = new PermissionDefinition({
  name: 'Picqer',
  description: 'Allows setting Picqer config and triggering Picqer full sync',
});

export * from './picqer.plugin';
export * from './api/types';
export * from './api/picqer.client';
export * from './api/picqer.resolvers';
export * from './api/picqer.service';
