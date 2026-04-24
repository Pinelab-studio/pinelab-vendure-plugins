import { api, getDetailQueryOptions } from '@vendure/dashboard';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import React from 'react';
import { toast } from 'sonner';

import { graphql } from '@vendure/dashboard';

const REFUND_ORDER = graphql(`
  mutation RefundOrder($input: RefundOrderInput!) {
    refundOrder(input: $input) {
      ... on Refund {
        id
      }
      ... on ErrorResult {
        message
      }
    }
  }
`);

const CANCEL_ORDER = graphql(`
  mutation CancelOrder($input: CancelOrderInput!) {
    cancelOrder(input: $input) {
      ... on Order {
        id
      }
      ... on ErrorResult {
        message
      }
    }
  }
`);

export const orderDetailDocument = graphql(
  `
    query GetOrder($id: ID!) {
      order(id: $id) {
        id
        shippingLines {
          id
          shippingMethod {
            id
            fulfillmentHandlerCode
          }
        }
        fulfillments {
          id
        }
      }
    }
  `
);

export function CancelOrderButton({
  context,
}: {
  context: { entity?: any; route?: any };
}) {
  const { entity } = context;
  const queryClient = useQueryClient();

  // 1. Initialize Mutations at the top level
  const refundMutation = useMutation({
    mutationFn: (input: any) => api.mutate(REFUND_ORDER, { input }),
    onSuccess: () => {
      const queryKey = getDetailQueryOptions(orderDetailDocument, {
        id: entity.id,
      }).queryKey;
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (input: any) => api.mutate(CANCEL_ORDER, { input }),
    onSuccess: () => {
      const queryKey = getDetailQueryOptions(orderDetailDocument, {
        id: entity.id,
      }).queryKey;
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleCancelAndRefund = async () => {
    try {
      if (!window.confirm('This will cancel and refund. Are you sure?')) {
        return;
      }

      const orderState = entity.state;

      // 2. Perform Refund if necessary
      if (['PaymentSettled', 'Delivered', 'Shipped'].includes(orderState)) {
        let lines = entity.lines.map((line: any) => ({
          quantity: line.quantity,
          orderLineId: String(line.id),
        }));

        await refundMutation.mutateAsync({
          lines: entity.state === 'AddingItems' ? [] : lines,
          reason: 'Manual refund',
          paymentId: entity.payments![0].id,
          adjustment: 0,
          shipping: entity.shippingWithTax,
        });
      }

      // 3. Perform Cancel
      await cancelMutation.mutateAsync({
        lines: entity.lines.map((line: any) => ({
          quantity: line.quantity,
          orderLineId: String(line.id),
        })),
        reason: 'Manual cancel',
        orderId: entity.id,
        cancelShipping: true,
      });

      toast.success('Order refunded and cancelled');
    } catch (e: any) {
      toast.error(e.message || 'An unexpected error occurred');
      console.error(e);
    }
  };

  return (
    <button
      onClick={handleCancelAndRefund}
      disabled={refundMutation.isPending || cancelMutation.isPending}
      className="btn btn-outline btn-warning flex items-center gap-2"
      type="button"
    >
      <i className="icon times-circle" aria-hidden="true"></i>
      {refundMutation.isPending || cancelMutation.isPending
        ? 'Processing...'
        : 'Cancel'}
    </button>
  );
}
