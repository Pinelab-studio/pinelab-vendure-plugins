import { useMutation } from '@tanstack/react-query';
import { api, Button, PermissionGuard } from '@vendure/dashboard';
import { PlayIcon } from 'lucide-react';
import { toast } from 'sonner';
import { CONTENT_AUTOMATION_PERMISSION } from '../permissions';
import { runContentAutomationForProductDocument } from '../queries';

/**
 * Queues every content automation strategy with `entityType: 'product'` for this product, in all
 * languages of the active channel. Only shown when content automation is enabled, via its permission.
 */
export function RunContentAutomationsButton({
  productId,
}: {
  productId: string;
}) {
  const mutation = useMutation({
    mutationFn: () =>
      api.mutate(runContentAutomationForProductDocument, { productId }),
    onSuccess: ({ runContentAutomationForProduct: { jobsCreated } }) =>
      toast.success(
        `Queued ${jobsCreated} content automation job${jobsCreated === 1 ? '' : 's'}`,
      ),
    onError: (err: unknown) =>
      toast.error(
        err instanceof Error ? err.message : 'Content automation failed',
      ),
  });
  return (
    <PermissionGuard requires={[CONTENT_AUTOMATION_PERMISSION]}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <PlayIcon className="mr-2 h-3.5 w-3.5" />
        {mutation.isPending ? 'Queueing…' : 'Run content automations'}
      </Button>
    </PermissionGuard>
  );
}
