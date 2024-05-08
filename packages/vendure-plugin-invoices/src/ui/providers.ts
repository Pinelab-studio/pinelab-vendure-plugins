import { addNavMenuItem, registerBulkAction } from '@vendure/admin-ui/core';

export default [
  addNavMenuItem(
    {
      id: 'invoice-list',
      label: 'Invoices',
      routerLink: ['/extensions/invoice-list'],
      requiresPermission: 'AllowInvoicesPermission',
      icon: 'star',
    },
    'sales'
  ),
  registerBulkAction({
    location: 'invoice-list',
    label: 'Download',
    icon: 'download',
    onClick: ({ injector, selection }) => {},
  }),
];
