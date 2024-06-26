import { NgModule } from '@angular/core';
import {
  addNavMenuItem,
  SharedModule,
  addActionBarItem,
} from '@vendure/admin-ui/core';
import {
  registerCustomDetailComponent,
  ActionBarButtonState,
} from '@vendure/admin-ui/core';

import { InvoiceDetailViewComponent } from './invoices-detail-view/invoices-detail-view.component';
import { createInvoice } from './queries.graphql';
import { catchError } from 'rxjs/operators';
import { ApolloCache } from '@apollo/client/cache';
import { map } from 'rxjs';

@NgModule({
  imports: [SharedModule],
  providers: [
    addNavMenuItem(
      {
        id: 'invoices',
        label: 'Invoices',
        routerLink: ['/extensions/invoices'],
        icon: 'file-group',
        requiresPermission: 'AllowInvoicesPermission',
      },
      'settings'
    ),
    registerCustomDetailComponent({
      locationId: 'order-detail',
      component: InvoiceDetailViewComponent,
    }),
    addActionBarItem({
      id: 'regenerate-invoice',
      label: 'Regenerate Invoice',
      locationId: 'order-detail',
      requiresPermission: ['AllowInvoicesPermission'],
      onClick: (event, context) => {
        const orderId = context.route.snapshot.params['id'];
        (event.target as HTMLButtonElement).disabled = true;
        context.dataService
          .mutate(createInvoice, { orderId }, (cache: ApolloCache<any>, _) => {
            cache.evict({ fieldName: 'invoices', id: `Order:${orderId}` });
          })
          .pipe(
            catchError((error) => {
              context.notificationService.error(
                'Failed to regenerate invoices'
              );
              (event.target as HTMLButtonElement).disabled = false;
              throw new Error('An error occurred. Please try again later.');
            })
          )
          .subscribe((data: any) => {
            if (data?.createInvoice?.id) {
              context.notificationService.success(
                'Invoice has been regenerated successfully'
              );
            } else {
              context.notificationService.error(
                'Failed to regenerate invoices'
              );
            }
            (event.target as HTMLButtonElement).disabled = false;
          });
      },
      buttonState: (context) => {
        const orderId = context.route.snapshot.params['id'];
        const order$ = context.dataService.order.getOrder(orderId);
        return order$.stream$.pipe(
          map(({ order }) => ({
            disabled: order?.state === 'Cancelled',
            visible: true,
          }))
        );
      },
    }),
  ],
})
export class InvoicesNavModule {}
