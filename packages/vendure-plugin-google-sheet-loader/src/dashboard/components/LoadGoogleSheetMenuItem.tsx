import { useMutation } from '@tanstack/react-query';
import { api, DropdownMenuItem } from '@vendure/dashboard';
import { RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { graphql } from '@/gql';

const loadDataFromGoogleSheetDocument = graphql(`
  mutation LoadDataFromGoogleSheet {
    loadDataFromGoogleSheet
  }
`);

/**
 * Action bar dropdown item for triggering a Google Sheet data load,
 * on the product list page. Actual processing happens async in the worker,
 * so success here only means the load was queued.
 */
export function LoadGoogleSheetMenuItem() {
  const { mutate: loadData, isPending } = useMutation({
    mutationFn: () => api.mutate(loadDataFromGoogleSheetDocument, {}),
    onSuccess: () => {
      toast.success('Loading data from Google Sheet...');
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to load data from Google Sheet');
    },
  });

  return (
    <DropdownMenuItem disabled={isPending} onClick={() => loadData()}>
      <RefreshCwIcon className="mr-2 h-4 w-4" />
      Load Google Sheet data
    </DropdownMenuItem>
  );
}
