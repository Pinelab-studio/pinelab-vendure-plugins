import { addActionBarItem } from '@vendure/admin-ui/core';
import { createInvoice } from './queries.graphql';
import { catchError } from 'rxjs/operators';
import { ApolloCache } from '@apollo/client/cache';
import { map } from 'rxjs';
import { GET_ORDER } from './helpers';
import { GetOrderQueryVariables } from '@vendure/admin-ui/core';
export function getRegenerateInvoiceButton(isStyled: boolean) {
  return addActionBarItem({
    id: isStyled ? 'regenerate-invoice-styled' : 'regenerate-invoice',
    label: 'Regenerate Invoice',
    locationId: 'order-detail',
    requiresPermission: ['AllowInvoicesPermission'],
    buttonColor: isStyled ? 'warning' : 'primary',
    buttonStyle: isStyled ? 'solid' : 'outline',
    onClick: (event, context) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const orderId = context.route.snapshot.params['id'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (event.target as HTMLButtonElement).disabled = true;
      context.dataService
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        .mutate(createInvoice, { orderId }, (cache: ApolloCache<any>) => {
          cache.evict({ fieldName: 'invoices', id: `Order:${orderId}` });
        })
        .pipe(
          catchError((error) => {
            context.notificationService.error('Failed to regenerate invoices');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (event.target as HTMLButtonElement).disabled = false;
            throw new Error(JSON.stringify(error));
          })
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .subscribe((data: any) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (data?.createInvoice?.id) {
            context.notificationService.success(
              'Invoice has been regenerated successfully'
            );
          } else {
            context.notificationService.error('Failed to regenerate invoices');
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          (event.target as HTMLButtonElement).disabled = false;
        });
    },
    buttonState: (context) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const orderId = context.route.snapshot.params['id'];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      const order$ = context.dataService.query<any, GetOrderQueryVariables>(
        GET_ORDER,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { id: orderId }
      );
      return order$.stream$.pipe(
        map(({ order }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const latestInvoice = order?.invoices[0];
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const orderTotalMatches =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            latestInvoice.orderTotals.totalWithTax === order?.totalWithTax;
          const showButton = isStyled !== orderTotalMatches;
          return {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            disabled: order?.state === 'Cancelled',
            visible: showButton,
          };
        })
      );
    },
  });
}
