import { addActionBarItem, SharedModule } from '@vendure/admin-ui/core';
import { NgModule } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { cancel, mapEntityToButtonState, refund } from './order-state.util';
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
      buttonState: mapEntityToButtonState,
      routerLink: [],
      onClick: async (event, { route, dataService, notificationService }) => {
        try {
          if (!window.confirm('This will cancel and refund. Are you sure?')) {
            return;
          }
          const orderId = route.snapshot.params.id;
          const response = await firstValueFrom(
            dataService.order.getOrder(orderId).single$
          );
          if (!response?.order) {
            return notificationService.error('Could not find order...');
          }
          if (
            response.order.state === 'PaymentSettled' ||
            response.order.state === 'Delivered' ||
            response.order.state === 'Shipped'
          ) {
            await refund(dataService, response.order);
          }
          await cancel(dataService, response.order);
          notificationService.success('Order refunded and cancelled');
        } catch (e: any) {
          notificationService.error(e.message);
          console.error(e);
        }
      },
    }),
  ],
})
export class CancelOrderButtonModule {}
