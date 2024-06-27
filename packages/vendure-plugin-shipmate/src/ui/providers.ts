import { addNavMenuItem } from '@vendure/admin-ui/core';

export default [
  addNavMenuItem(
    {
      id: 'shipmate-config',
      label: 'Shipmate',
      routerLink: ['/extensions/shipmate-config'],
      requiresPermission: 'SetShipmateConfig',
      icon: 'star',
    },
    'settings'
  ),
];
