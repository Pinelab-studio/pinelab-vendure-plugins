import { addNavMenuItem } from '@vendure/admin-ui/core';

export default [
  addNavMenuItem(
    {
      id: 'campaigns',
      label: 'Campaigns',
      routerLink: ['/extensions/campaigns'],
      icon: 'target',
    },
    'marketing'
  ),
];
