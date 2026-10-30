import { useMutation } from '@tanstack/react-query';
import {
  api,
  DropdownMenuItem,
  defineDashboardExtension,
} from '@vendure/dashboard';
import { RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { graphql } from '@/gql';

const sendToSendCloudDocument = graphql(`
  mutation SendToSendCloud($orderId: ID!) {
    sendToSendCloud(orderId: $orderId)
  }
`);

/**
 * Action bar dropdown item for manually syncing an order to SendCloud,
 * on the order detail page of orders that use the SendCloud handler.
 */
function SyncToSendcloudMenuItem({ context }: { context: { entity?: any } }) {
  const order = context.entity;

  const { mutate: syncOrder, isPending } = useMutation({
    mutationFn: () =>
      api.mutate(sendToSendCloudDocument, { orderId: order.id }),
    onSuccess: () => {
      toast.success('Synced order to SendCloud');
    },
    onError: (error: Error) => {
      toast.error(`Failed to sync order to SendCloud: ${error.message}`);
    },
  });

  const hasSendcloudHandler = order?.shippingLines?.some(
    (line: any) => line.shippingMethod?.fulfillmentHandlerCode === 'sendcloud',
  );
  if (!hasSendcloudHandler) {
    return null;
  }

  return (
    <DropdownMenuItem disabled={isPending} onClick={() => syncOrder()}>
      <RefreshCwIcon className="h-4 w-4" />
      Sync to SendCloud
    </DropdownMenuItem>
  );
}

defineDashboardExtension({
  actionBarItems: [
    {
      pageId: 'order-detail',
      type: 'dropdown',
      requiresPermission: 'UpdateOrder',
      component: ({ context }) => <SyncToSendcloudMenuItem context={context} />,
    },
  ],
});
