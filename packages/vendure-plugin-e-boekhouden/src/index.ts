import { PermissionDefinition } from '@vendure/core';

export const eBoekhoudenPermission = new PermissionDefinition({
  name: 'eBoekhouden',
  description: 'Allows enabling e-Boekhouden plugin',
});
export * from './ui/generated/graphql';
export * from './e-boekhouden.plugin';
