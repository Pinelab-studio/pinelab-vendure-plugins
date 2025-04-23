import { addActionBarItem } from '@vendure/admin-ui/core';
import { createInvoice } from './queries.graphql';
import { catchError } from 'rxjs/operators';
import { ApolloCache } from '@apollo/client/cache';
import { map } from 'rxjs';
import { GetOrderQueryVariables, GetOrderQuery } from '@vendure/admin-ui/core';

import gql from 'graphql-tag';
export const GET_ORDER = gql`
  query GetOrder($id: ID!) {
    order(id: $id) {
      id
      orderPlacedAt
      invoices {
        id
        createdAt
        invoiceNumber
        downloadUrl
        orderCode
        orderId
        isCreditInvoice
        orderTotals {
          totalWithTax
        }
      }
      state
      totalWithTax
    }
  }
`;

/**
 * Get action bar button for the invoice detail view.
 * Creates a yellow 'urgent' button when isWarningButton is true.
 *
 * Warning button is shown when the order totals don't match.
 * Normal button is shown when the order totals match.
 */
export function getActionBarInvoiceButton(isWarningButton: boolean) {
  return addActionBarItem({
    id: isWarningButton ? 'regenerate-invoice-styled' : 'regenerate-invoice',
    label: 'Regenerate Invoice',
    locationId: 'order-detail',
    requiresPermission: ['AllowInvoicesPermission'],
    buttonColor: isWarningButton ? 'warning' : 'primary',
    buttonStyle: isWarningButton ? 'solid' : 'outline',
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
          if (!order?.orderPlacedAt || order?.state === 'Cancelled') {
            return {
              // Don't show any button for non-placed orders or cancelled orders
              disabled: true,
              visible: false,
            };
          }
          const orderTotalMatches =
            order?.invoices?.[0]?.orderTotals.totalWithTax ===
            order?.totalWithTax;
          if (isWarningButton) {
            if (!orderTotalMatches) {
              context.notificationService.notify({
                message:
                  'Order total changed, you should regenerate the invoice!',
                type: 'warning',
                duration: 60000, // Stay for one minute
              });
            }
            // Show the Warning Button when order totals don't match (urgent!)
            return {
              disabled: false,
              visible: !orderTotalMatches,
            };
          } else {
            // Show the normal outlined button when order totals match (not urgent).
            return {
              disabled: false,
              visible: orderTotalMatches,
            };
          }
        })
      );
    },
  });
}
