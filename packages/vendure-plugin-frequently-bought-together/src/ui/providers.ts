import {
  addActionBarDropdownMenuItem,
  ModalService,
} from '@vendure/admin-ui/core';

export default [
  addActionBarDropdownMenuItem({
    id: 'generate-frequently-bought-together',
    label: 'Calculate frequently-bought-together relations',
    locationId: 'product-list',
    icon: 'switch',
    onClick: async (event, { dataService, notificationService, injector }) => {
      console.log('Generate frequently-bought-together products');
    },
  }),
];
