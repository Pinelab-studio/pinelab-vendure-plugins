import { api, DropdownMenuItem } from '@vendure/dashboard';
import { useMutation } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { triggerQlsProductSyncDocument } from '../qls-dashboard.graphql';

/**
 * Dropdown action bar item on the product list that triggers a full
 * product synchronization with QLS.
 */
export function SyncProductsMenuItem() {
  const { mutate: sync, isPending } = useMutation({
    mutationFn: () => api.mutate(triggerQlsProductSyncDocument, {}),
    onSuccess: () => {
      toast.success('Triggered QLS full product sync...');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to trigger QLS product sync');
    },
  });

  return (
    <DropdownMenuItem disabled={isPending} onClick={() => sync()}>
      <RefreshCw
        className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
      />
      Synchronize with QLS
    </DropdownMenuItem>
  );
}
