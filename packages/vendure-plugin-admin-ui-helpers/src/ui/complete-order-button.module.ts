import { addActionBarItem, SharedModule } from '@vendure/admin-ui/core';
import { NgModule } from '@angular/core';
import { Observable } from 'rxjs';
import { transitionToDelivered, transitionToShipped } from './order-state.util';
import { RouterModule } from '@angular/router';

@NgModule({
  imports: [
    SharedModule,
    RouterModule.forRoot([], { onSameUrlNavigation: 'reload' }),
  ],
  providers: [
    addActionBarItem({
      id: 'complete-order',
      label: 'Complete',
      disabled: new Observable<boolean>((subscriber) => {
        subscriber.next(false);
      }),
      buttonColor: 'success',
      buttonStyle: 'outline',
      icon: 'check-circle',
      locationId: 'order-detail',
      routerLink: [],
      onClick: async (event, { route, dataService, notificationService }) => {
        try {
          if (!window.confirm('Are you sure? This can not be undone.')) {
            return;
          }
          const orderId = route.snapshot.params.id;
          let getOrderResponse = await dataService.order
            .getOrder(orderId)
            .single$.toPromise();
          if (!getOrderResponse?.order) {
            return notificationService.error('Could not find order...');
          }
          if (getOrderResponse?.order.state === 'AddingItems') {
            return notificationService.error(
              'Active orders cannot be completed.'
            );
          }
          if (getOrderResponse?.order.state === 'Delivered') {
            return notificationService.warning('Order is already Delivered.');
          }
          if (getOrderResponse?.order.state === 'Cancelled') {
            return notificationService.error('Order is already Cancelled.');
          }
          if (getOrderResponse?.order.state === 'PaymentSettled') {
            await transitionToShipped(dataService, getOrderResponse.order);
            await dataService.order.getOrder(orderId).single$.toPromise();
          }
          if (getOrderResponse?.order!.state === 'Shipped') {
            await transitionToDelivered(dataService, getOrderResponse.order);
          }
          await dataService.order.getOrder(orderId).single$.toPromise();
          notificationService.success('Order completed');
        } catch (e: any) {
          notificationService.error(e.message);
          console.error(e);
        }
      },
    }),
  ],
})
export class CompleteOrderButtonModule {}
