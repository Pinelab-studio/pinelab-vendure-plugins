import { addActionBarItem, SharedModule } from '@vendure/admin-ui/core';
import { NgModule } from '@angular/core';
import { Observable } from 'rxjs';
import {
  cancel,
  refund,
  transitionToDelivered,
  transitionToShipped,
} from './order-state.util';
import { RouterModule } from '@angular/router';

@NgModule({
  imports: [
    SharedModule,
    RouterModule.forRoot([], { onSameUrlNavigation: 'reload' }),
  ],
  providers: [
    addActionBarItem({
      id: 'refund-order',
      label: 'Cancel',
      disabled: new Observable<boolean>((subscriber) => {
        subscriber.next(false);
      }),
      buttonColor: 'warning',
      buttonStyle: 'outline',
      icon: 'times-circle',
      locationId: 'order-detail',
      routerLink: [],
      onClick: async (event, { route, dataService, notificationService }) => {
        try {
          if (!window.confirm('This will cancel and refund. Are you sure?')) {
            return;
          }
          const orderId = route.snapshot.params.id;
          let { order } = await dataService.order
            .getOrder(orderId)
            .single$.toPromise();
          if (!order) {
            return notificationService.error('Could not find order...');
          }
          if (
            order.state === 'PaymentSettled' ||
            order.state === 'Delivered' ||
            order.state === 'Shipped'
          ) {
            await refund(dataService, order);
          }
          await cancel(dataService, order);
          notificationService.success('Order refunded and cancelled');
        } catch (e) {
          notificationService.error(e.message);
          console.error(e);
        }
      },
    }),
  ],
})
export class CancelOrderButtonModule {}
