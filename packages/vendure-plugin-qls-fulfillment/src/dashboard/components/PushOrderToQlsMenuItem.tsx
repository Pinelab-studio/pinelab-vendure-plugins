import {
  api,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenuItem,
} from '@vendure/dashboard';
import { useQuery, useMutation } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  orderQlsIdsDocument,
  pushOrderToQlsDocument,
} from '../qls-dashboard.graphql';

interface PushOrderToQlsMenuItemProps {
  context: { entity?: any };
}

/**
 * Dropdown action bar item on the order detail page that pushes the order
 * to QLS. If the order already exists in QLS, a confirmation dialog is shown.
 */
export function PushOrderToQlsMenuItem({
  context,
}: PushOrderToQlsMenuItemProps) {
  const orderId = context.entity?.id;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: orderData } = useQuery({
    queryKey: ['qls-order-ids', orderId],
    queryFn: () => api.query(orderQlsIdsDocument, { id: orderId! }),
    enabled: !!orderId,
  });

  const { mutate: pushOrder, isPending } = useMutation({
    mutationFn: () => api.mutate(pushOrderToQlsDocument, { orderId: orderId! }),
    onSuccess: (message) => {
      toast.success(message ?? 'Order pushed to QLS');
      setConfirmOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to push order to QLS');
    },
  });

  const handleClick = () => {
    const existingIds = orderData?.order?.qlsOrderIds ?? [];
    if (existingIds.length > 0) {
      setConfirmOpen(true);
    } else {
      pushOrder();
    }
  };

  return (
    <>
      <DropdownMenuItem disabled={!orderId || isPending} onClick={handleClick}>
        <RefreshCw
          className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
        />
        Push order to QLS
      </DropdownMenuItem>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Push order to QLS</DialogTitle>
            <DialogDescription>
              This order already exists in QLS. Are you sure you want to push it
              again?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => pushOrder()}
            >
              Push to QLS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
