import { api, Button, PermissionGuard } from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangleIcon, RefreshCwIcon } from 'lucide-react';

const getOrderWithInvoicesDocument = graphql(`
  query GetOrderForInvoiceButton($id: ID!) {
    order(id: $id) {
      id
      orderPlacedAt
      state
      totalWithTax
      invoices {
        id
        invoiceNumber
        orderTotals {
          totalWithTax
        }
      }
    }
  }
`);

const createInvoiceDocument = graphql(`
  mutation CreateInvoice($orderId: ID!) {
    createInvoice(orderId: $orderId) {
      id
      invoiceNumber
    }
  }
`);

/**
 * Action bar button for regenerating invoices on the order detail page.
 * Shows a destructive variant when order totals don't match the latest invoice,
 * and an outlined button when they do match.
 */
export function RegenerateInvoiceButton({
  context,
}: {
  context: { entity?: any; route?: any };
}) {
  const orderId = context.entity?.id;
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['order-invoice-totals', orderId],
    queryFn: () => api.query(getOrderWithInvoicesDocument, { id: orderId! }),
    enabled: !!orderId,
  });

  const { mutate: regenerate, isPending } = useMutation({
    mutationFn: () => api.mutate(createInvoiceDocument, { orderId: orderId! }),
    onSuccess: () => {
      toast.success('Invoice has been regenerated successfully');
      queryClient.invalidateQueries({
        queryKey: ['order-invoice-totals', orderId],
      });
      queryClient.invalidateQueries({
        queryKey: ['order-invoices', orderId],
      });
    },
    onError: () => toast.error('Failed to regenerate invoice'),
  });

  // Don't render until we have data
  const order = (data?.order as any) ?? null;
  if (!order) return null;

  // Don't show for non-placed or cancelled orders
  if (!order.orderPlacedAt || order.state === 'Cancelled') {
    return null;
  }

  const latestInvoice = order.invoices?.[0];
  const totalsMismatch =
    latestInvoice?.orderTotals?.totalWithTax !== order.totalWithTax;

  return (
    <PermissionGuard requires={['AllowInvoicesPermission']}>
      <Button
        type="button"
        variant={totalsMismatch ? 'destructive' : 'outline'}
        onClick={() => regenerate()}
        disabled={isPending}
      >
        {totalsMismatch ? (
          <AlertTriangleIcon className="mr-2 h-4 w-4" />
        ) : (
          <RefreshCwIcon
            className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
          />
        )}
        Regenerate Invoice
      </Button>
    </PermissionGuard>
  );
}
