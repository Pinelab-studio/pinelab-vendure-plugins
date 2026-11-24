import { useMutation, useQuery } from '@tanstack/react-query';
import {
  api,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@vendure/dashboard';
import { ChevronDownIcon, PlayIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  productContentAutomationStrategiesDocument,
  runContentAutomationStrategyForProductDocument,
} from '../queries';

/** Collapsed product automation actions, with synchronous feedback per strategy and language. */
export function RunContentAutomationsButton({
  productId,
}: {
  productId: string;
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['product-content-automation-strategies'],
    queryFn: () => api.query(productContentAutomationStrategiesDocument),
    enabled: open,
  });
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md text-left font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        Content automation
        <ChevronDownIcon className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-4">
        {isLoading && (
          <p className="text-muted-foreground text-sm">Loading strategies…</p>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error.message}
          </p>
        )}
        {data?.productContentAutomationStrategies.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No product automation strategies configured.
          </p>
        )}
        <div className="flex flex-wrap items-start gap-2">
          {data?.productContentAutomationStrategies.map((strategyName) => (
            <StrategyAction
              key={`${productId}:${strategyName}`}
              productId={productId}
              strategyName={strategyName}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Runs a single strategy and reports completed results, skips or errors via Dashboard toasts. */
function StrategyAction({
  productId,
  strategyName,
}: {
  productId: string;
  strategyName: string;
}) {
  const mutation = useMutation({
    mutationFn: () =>
      api.mutate(runContentAutomationStrategyForProductDocument, {
        productId,
        strategyName,
      }),
    onSuccess: ({ runContentAutomationStrategyForProduct: results }) => {
      const notify = results.some((result) => result.generated)
        ? toast.success
        : toast.info;
      notify(strategyName, {
        description: results
          .map(
            (result) =>
              `${result.languageCode}: ${
                result.generated
                  ? result.resultMessage || 'Content generated.'
                  : 'Skipped: no matching input or strategy returned no result.'
              }`,
          )
          .join('\n'),
      });
    },
    onError: (error) =>
      toast.error(`${strategyName} failed`, {
        description: `${error.message} Earlier languages may already have completed.`,
      }),
  });
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <PlayIcon className="mr-2 h-3.5 w-3.5" />
      {mutation.isPending ? `Running ${strategyName}…` : `Run ${strategyName}`}
    </Button>
  );
}
