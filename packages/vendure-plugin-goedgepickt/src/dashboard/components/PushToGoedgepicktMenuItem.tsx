import { DropdownMenuItem, api } from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCwIcon } from 'lucide-react';

const syncOrderToGoedgepicktDocument = graphql(`
  mutation SyncOrderToGoedgepickt($orderCode: String!) {
    syncOrderToGoedgepickt(orderCode: $orderCode)
  }
`);

/**
 * Action bar dropdown item for manually pushing an order to GoedGepickt,
 * on the order detail page.
 */
export function PushToGoedgepicktMenuItem({
  context,
}: {
  context: { entity?: any };
}) {
  const orderCode = context.entity?.code;

  const { mutate: pushOrder, isPending } = useMutation({
    mutationFn: () =>
      api.mutate(syncOrderToGoedgepicktDocument, { orderCode: orderCode! }),
    onSuccess: () => {
      toast.success('Success');
    },
    onError: () => {
      toast.error('Error');
    },
  });

  if (!orderCode) {
    return null;
  }

  return (
    <DropdownMenuItem disabled={isPending} onClick={() => pushOrder()}>
      <RefreshCwIcon className="mr-2 h-4 w-4" />
      Push to Goedgepickt
    </DropdownMenuItem>
  );
}
