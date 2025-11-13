import { addActionBarDropdownMenuItem } from '@vendure/admin-ui/core';
import gql from 'graphql-tag';

export default [
  addActionBarDropdownMenuItem({
    id: 'qls-fulfillment-sync',
    label: 'Synchronize with QLS',
    locationId: 'product-list',
    icon: 'resistor',
    requiresPermission: ['QLSFullSync'],
    onClick: (_, { dataService, notificationService }) => {
      dataService
        .mutate(
          gql`
            mutation TriggerQlsProductSync {
              triggerQlsProductSync
            }
          `
        )
        .subscribe({
          next: () => {
            notificationService.notify({
              message: `Triggered QLS full product sync...`,
              type: 'success',
            });
          },
          error: (err) => {
            notificationService.notify({
              message: err.message,
              type: 'error',
            });
          },
        });
    },
  }),
];
