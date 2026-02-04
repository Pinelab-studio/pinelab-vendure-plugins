import {
  addActionBarDropdownMenuItem,
  ModalService,
} from '@vendure/admin-ui/core';
import { firstValueFrom } from 'rxjs';
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
    onClick: async (
      _,
      { route, dataService, notificationService, injector }
    ) => {
      const orderId = route.snapshot.params.id;
      const res = await firstValueFrom(
        dataService.query(
          gql`
            query Order($orderId: ID!) {
              order(id: $orderId) {
                id
                qlsOrderIds
              }
            }
          `,
          { orderId }
        ).single$
      );
      if ((res as any).order.qlsOrderIds.length > 0) {
        const modalService = injector.get(ModalService);
        const confirmed = await firstValueFrom(
          modalService.dialog({
            title: 'Push order to QLS',
            body: 'This order already exists in QLS. Are you sure you want to push it again?',
            buttons: [
              { type: 'secondary', label: 'Cancel', returnValue: false },
              { type: 'primary', label: 'Push to QLS', returnValue: true },
            ],
          })
        );
        if (!confirmed) return;
      }

      dataService
        .mutate(
          gql`
            mutation PushOrderToQls($orderId: ID!) {
              pushOrderToQls(orderId: $orderId)
            }
          `,
          { orderId }
        )
        .subscribe({
          next: (result) => {
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
