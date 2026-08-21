import {
  api,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@vendure/dashboard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  RefreshCwIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  contentCheckResultsDocument,
  runContentCheckForCollectionDocument,
  runContentCheckForProductDocument,
} from '../queries';
import { ContentCheckFindingsList } from './ContentCheckFindingsList';

interface ContentCheckFindingsBlockInnerProps {
  context: { entity?: { id?: string } };
  entityType: 'PRODUCT' | 'COLLECTION';
}

/**
 * Shared implementation for the product-detail and collection-detail page
 * blocks: shows the entity's current warnings/errors across every checked
 * channel/language, plus a button to manually re-check just this entity
 * right now.
 */
function ContentCheckFindingsBlockInner({
  context,
  entityType,
}: ContentCheckFindingsBlockInnerProps) {
  const entity = context.entity;
  const entityId = entity?.id;
  const queryClient = useQueryClient();
  const queryKey = ['content-check-results', entityType, entityId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      api.query(contentCheckResultsDocument, {
        entityType,
        entityId: entityId as string,
      }),
    enabled: !!entityId,
  });

  const checkNowMutation = useMutation({
    mutationFn: async () => {
      if (!entityId) {
        throw new Error('Missing entity id');
      }
      if (entityType === 'PRODUCT') {
        await api.mutate(runContentCheckForProductDocument, {
          productId: entityId,
        });
      } else {
        await api.mutate(runContentCheckForCollectionDocument, {
          collectionId: entityId,
        });
      }
    },
    onSuccess: async () => {
      toast.success('SEO/content check complete');
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({
        queryKey: ['content-health-overview'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['content-health-issues'],
      });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : 'Check failed'),
  });

  const checkNowButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!entityId || checkNowMutation.isPending}
      onClick={() => checkNowMutation.mutate()}
    >
      <RefreshCwIcon
        className={`h-3.5 w-3.5 mr-2 ${
          checkNowMutation.isPending ? 'animate-spin' : ''
        }`}
      />
      {checkNowMutation.isPending ? 'Checking…' : 'Check now'}
    </Button>
  );

  if (!entityId) {
    return null;
  }

  const results = data?.contentCheckResults ?? [];
  const allMessages = results.flatMap((r) =>
    r.messages.map((m) => ({ ...m, languageCode: r.languageCode }))
  );
  const hasErrors = results.some((result) =>
    result.messages.some((message) => message.severity === 'ERROR')
  );
  const StatusIcon = hasErrors ? AlertTriangleIcon : CheckCircle2Icon;

  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <span className="flex items-center gap-2 font-semibold">
          <StatusIcon
            className={`h-4 w-4 ${
              hasErrors ? 'text-yellow-600' : 'text-success'
            }`}
          />
          SEO / content checks
        </span>
        <ChevronDownIcon className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <div className="space-y-2">
          {checkNowButton}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading checks…</p>
          ) : (
            <ContentCheckFindingsList messages={allMessages} />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ProductContentCheckFindingsBlock({
  context,
}: {
  context: ContentCheckFindingsBlockInnerProps['context'];
}) {
  return (
    <ContentCheckFindingsBlockInner context={context} entityType="PRODUCT" />
  );
}

export function CollectionContentCheckFindingsBlock({
  context,
}: {
  context: ContentCheckFindingsBlockInnerProps['context'];
}) {
  return (
    <ContentCheckFindingsBlockInner context={context} entityType="COLLECTION" />
  );
}
