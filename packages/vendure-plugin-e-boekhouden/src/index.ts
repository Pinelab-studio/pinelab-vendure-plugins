import { PermissionDefinition } from '@vendure/core';

export const eBoekhoudenPermission = new PermissionDefinition({
  name: 'Eboekhouden',
  description: 'Allows enabling e-boekhouden plugin',
});
export * from './ui/generated/graphql';
export * from './e-boekhouden.plugin';
