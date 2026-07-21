import { DropdownMenuItem, api } from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCwIcon } from 'lucide-react';

const runGoedgepicktFullSyncDocument = graphql(`
  mutation RunGoedgepicktFullSync {
    runGoedgepicktFullSync
  }
`);

/**
 * Action bar dropdown item for triggering a full GoedGepickt sync
 * (push products, pull stock levels), on the product list page.
 */
export function GoedgepicktFullSyncMenuItem() {
  const { mutate: runFullSync, isPending } = useMutation({
    mutationFn: () => api.mutate(runGoedgepicktFullSyncDocument, {}),
    onSuccess: () => {
      toast.success('Started full sync. This might take about 15 minutes...');
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to start full sync');
    },
  });

  return (
    <DropdownMenuItem disabled={isPending} onClick={() => runFullSync()}>
      <RefreshCwIcon className="mr-2 h-4 w-4" />
      GoedGepickt full sync
    </DropdownMenuItem>
  );
}
