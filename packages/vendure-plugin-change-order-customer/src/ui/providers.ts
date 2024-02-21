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
          if ((result as any).id) {
            // this means that the customer was selected from the list
            context.dataService
              .mutate(CHANGE_ORDER_CUSTOMER, {
                orderId,
                customerId: (result as any).id,
              })
              .subscribe((result: any) => {
                if (result.setCustomerForOrder?.id) {
                  context.notificationService.success(
                    `${result.setCustomerForOrder.customer.emailAddress} set as customer`
                  );
                } else {
                  context.notificationService.error(
                    'Failed to change Customer'
                  );
                }
              });
          } else if (result) {
            // This means we create a new customer based on given input
            context.dataService
              .mutate(CHANGE_ORDER_CUSTOMER, { orderId, input: result })
              .subscribe((result: any) => {
                if (result.setCustomerForOrder?.id) {
                  context.notificationService.success(
                    `Created '${result.setCustomerForOrder.customer.emailAddress}' as customer for this order.`
                  );
                } else {
                  context.notificationService.error(
                    'Failed to change Customer'
                  );
                }
              });
          } else {
            // Should never happen, but the type system says the result from the customer dialog can be undefined
            throw new Error('No customer selected!');
          }
        });
    },
  }),
];
