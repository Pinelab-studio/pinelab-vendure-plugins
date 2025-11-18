import { addActionBarDropdownMenuItem } from '@vendure/admin-ui/core';
import gql from 'graphql-tag';

export default [
  // Product sync button in product list
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
  // Push order to QLS button on order detail page
  addActionBarDropdownMenuItem({
    id: 'qls-fulfillment-push-order',
    label: 'Push order to QLS',
    locationId: 'order-detail',
    icon: 'resistor',
    requiresPermission: ['QLSFullSync'],
    hasDivider: true,
    onClick: (_, { route, dataService, notificationService }) => {
      dataService
        .mutate(
          gql`
            mutation PushOrderToQls($orderId: ID!) {
              pushOrderToQls(orderId: $orderId)
            }
          `,
          {
            orderId: route.snapshot.params.id,
          }
        )
        .subscribe({
          next: (result) => {
            console.log(result);
            notificationService.notify({
              message: (result as any).pushOrderToQls,
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
