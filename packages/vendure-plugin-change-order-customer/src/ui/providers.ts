import { addActionBarItem, ModalService } from '@vendure/admin-ui/core';
import { CHANGE_ORDER_CUSTOMER } from './change-customer.graphql';
import { SelectCustomerDialogComponent } from '@vendure/admin-ui/order';

export default [
  addActionBarItem({
    id: 'change-customer',
    label: 'Change customer',
    locationId: 'order-detail',
    onClick: (event, context) => {
      const modalService = context.injector.get(ModalService);
      const orderId = context.route.snapshot.paramMap.get('id');
      modalService
        .fromComponent(SelectCustomerDialogComponent)
        .subscribe((result) => {
          if (!(result as any).id) {
            // This means successful
            context.dataService
              .mutate(CHANGE_ORDER_CUSTOMER, { orderId, input: result })
              .subscribe((result: any) => {
                if (result.setCustomerForOrder?.id) {
                  context.notificationService.success(
                    `${result.setCustomerForOrder.customer.emailAddress} set as Customer`
                  );
                } else {
                  context.notificationService.error(
                    'Failed to change Customer'
                  );
                }
              });
          } else if (result) {
            context.dataService
              .mutate(CHANGE_ORDER_CUSTOMER, {
                orderId,
                customerId: (result as any).id,
              })
              .subscribe((result: any) => {
                if (result.setCustomerForOrder?.id) {
                  context.notificationService.success(
                    'Customer changed successfully'
                  );
                } else {
                  context.notificationService.error(
                    'Failed to change Customer'
                  );
                }
              });
          } else {
            throw new Error('Not Implemented');
          }
        });
    },
  }),
];
