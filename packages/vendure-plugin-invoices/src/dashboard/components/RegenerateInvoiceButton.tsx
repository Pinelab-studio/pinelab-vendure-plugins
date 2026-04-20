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

interface RegenerateInvoiceButtonProps {
  context: { entity?: any; route?: any };
  /** When true, shows a warning-style button for mismatched totals */
  isWarning: boolean;
}

/**
 * Action bar button for regenerating invoices on the order detail page.
 * Shows a warning variant when order totals don't match the latest invoice,
 * and a normal outlined button when they do.
 */
export function RegenerateInvoiceButton({
  context,
  isWarning,
}: RegenerateInvoiceButtonProps) {
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
  const orderTotalMatches =
    latestInvoice?.orderTotals?.totalWithTax === order.totalWithTax;

  // Warning button: only visible when totals DON'T match
  if (isWarning && orderTotalMatches) return null;
  // Normal button: only visible when totals DO match
  if (!isWarning && !orderTotalMatches) return null;

  return (
    <PermissionGuard requires={['AllowInvoicesPermission']}>
      <Button
        type="button"
        variant={isWarning ? 'destructive' : 'outline'}
        onClick={() => regenerate()}
        disabled={isPending}
      >
        {isWarning ? (
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
