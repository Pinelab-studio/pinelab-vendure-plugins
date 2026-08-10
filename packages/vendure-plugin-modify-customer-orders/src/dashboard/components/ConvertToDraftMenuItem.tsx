import { DropdownMenuItem, api } from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { HistoryIcon } from 'lucide-react';

const convertOrderToDraftDocument = graphql(`
  mutation ConvertOrderToDraft($id: ID!) {
    convertOrderToDraft(id: $id) {
      id
      state
    }
  }
`);

/**
 * Action bar dropdown item for converting an active order to a Draft order,
 * on the order detail page.
 */
export function ConvertToDraftMenuItem({
  context,
}: {
  context: { entity?: any };
}) {
  const orderId = context.entity?.id;
  const navigate = useNavigate();

  const { mutate: convertToDraft, isPending } = useMutation({
    mutationFn: () => api.mutate(convertOrderToDraftDocument, { id: orderId! }),
    onSuccess: async (result: any) => {
      toast.success('Successfully created a Draft order');
      // Reload the page after a short delay to ensure page switches to draft ui
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to convert order to draft');
    },
  });

  if (!orderId) {
    return null;
  }

  return (
    <DropdownMenuItem disabled={isPending} onClick={() => convertToDraft()}>
      <HistoryIcon className="mr-2 h-4 w-4" />
      Convert to Draft
    </DropdownMenuItem>
  );
}
