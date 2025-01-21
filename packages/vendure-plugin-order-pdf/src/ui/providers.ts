import {
  addActionBarDropdownMenuItem,
  addNavMenuItem,
  ModalService,
  registerBulkAction,
} from '@vendure/admin-ui/core';

export default [
  addNavMenuItem(
    {
      id: 'pdf-templates',
      label: 'PDF Templates',
      routerLink: ['/extensions/pdf-templates'],
      icon: 'printer',
    },
    'settings'
  ),
  addActionBarDropdownMenuItem({
    id: 'print-invoice',
    locationId: 'order-detail',
    label: 'Print invoice',
    icon: 'printer',
    routerLink: (route) => {
      const id = route.snapshot.params.id;
      return ['./extensions/order-invoices', id];
    },
    requiresPermission: 'ReadOrder',
    hasDivider: true,
  }),
  registerBulkAction({
    // This tells the Admin UI that this bulk action should be made
    // available on the product list view.
    location: 'product-list',
    label: 'Send to translation service',
    icon: 'language',
    // Here is the logic that is executed when the bulk action menu item
    // is clicked.
    onClick: ({ injector, selection }) => {
      const modalService = injector.get(ModalService);
      modalService
        .dialog({
          title: `Send ${selection.length} products for translation?`,
          buttons: [
            { type: 'secondary', label: 'cancel' },
            { type: 'primary', label: 'send', returnValue: true },
          ],
        })
        .subscribe((response) => {});
    },
  }),
];
