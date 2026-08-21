import {
  api,
  Button,
  DashboardRouteDefinition,
  Page,
  PageActionBar,
  PageActionBarRight,
  PageBlock,
  PageLayout,
  PageTitle,
} from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnyRoute, Link } from '@tanstack/react-router';
import { ExternalLinkIcon, RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { entityTypeLabel, isCoreEntityType } from '../entity-type-label';
import {
  contentCheckResultsDocument,
  runContentCheckForCollectionDocument,
  runContentCheckForProductDocument,
} from '../queries';
import { ContentCheckFindingsList } from './ContentCheckFindingsList';

const productForIssueDetailDocument = graphql(`
  query ProductForContentCheckIssueDetail($id: ID!) {
    product(id: $id) {
      id
      name
    }
  }
`);

const collectionForIssueDetailDocument = graphql(`
  query CollectionForContentCheckIssueDetail($id: ID!) {
    collection(id: $id) {
      id
      name
    }
  }
`);

/**
 * Standalone detail page for a single entity's SEO/content findings,
 * reachable from the issues list. The entity isn't a normal editable
 * resource here (no create/update mutation makes sense for a read-only
 * aggregation), so this is a plain read-only page rather than a
 * `useDetailPage`-backed form.
 *
 * `entityType` is 'PRODUCT'/'COLLECTION' for the built-in scan pipeline, or
 * a free-form custom type from an `additionalChecks` function. For the
 * former, the entity's live name/existence is resolved via the normal
 * product/collection admin queries. For the latter, there is no generic way
 * to do either, so the page relies entirely on the `label`/`url` captured
 * on the check result itself.
 */
export function ContentCheckIssueDetailPage({ route }: { route: AnyRoute }) {
  const params = route.useParams() as {
    entityType?: string;
    entityId?: string;
  };
  const entityType = params.entityType ?? '';
  const entityId = params.entityId;
  const isProduct = entityType === 'PRODUCT';
  const isCollection = entityType === 'COLLECTION';
  const isCustomEntity = !isCoreEntityType(entityType);
  const queryClient = useQueryClient();

  const entityQuery = useQuery({
    queryKey: ['content-health-issue-entity', entityType, entityId],
    queryFn: async () => {
      if (isProduct) {
        const result = await api.query(productForIssueDetailDocument, {
          id: entityId as string,
        });
        return result.product ?? null;
      }
      const result = await api.query(collectionForIssueDetailDocument, {
        id: entityId as string,
      });
      return result.collection ?? null;
    },
    enabled: !!entityId && !isCustomEntity,
  });

  const resultsQueryKey = ['content-check-results', entityType, entityId];
  const resultsQuery = useQuery({
    queryKey: resultsQueryKey,
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
      if (isProduct) {
        await api.mutate(runContentCheckForProductDocument, {
          productId: entityId,
        });
        return;
      }
      if (isCollection) {
        await api.mutate(runContentCheckForCollectionDocument, {
          collectionId: entityId,
        });
        return;
      }
      throw new Error(
        'This entity type has no manual re-check — it is only checked as part of a full scan.'
      );
    },
    onSuccess: async () => {
      toast.success('SEO/content check complete');
      await queryClient.invalidateQueries({ queryKey: resultsQueryKey });
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

  if (!entityId) {
    return (
      <Page pageId="content-health-issue-detail">
        <PageTitle>SEO / content issue</PageTitle>
        <PageLayout>
          <PageBlock column="main" blockId="missing-id">
            <p className="text-sm text-muted-foreground">Missing entity id.</p>
          </PageBlock>
        </PageLayout>
      </Page>
    );
  }

  const entity = entityQuery.data ?? undefined;
  // Only products/collections have a generic "does this still exist" check;
  // a custom entity type has no such lookup, so it's never treated as
  // "not found" here — a stale row just keeps showing its last known label.
  const entityNotFound =
    !isCustomEntity &&
    !entityQuery.isLoading &&
    entityQuery.isFetched &&
    !entity;

  const results = resultsQuery.data?.contentCheckResults ?? [];
  const storedLabel = results.find((r) => r.label)?.label ?? undefined;
  const storedUrl = results.find((r) => r.url)?.url ?? undefined;

  // Edge cases: a blank/whitespace-only name falls back to a stable,
  // identifiable placeholder instead of an empty page title.
  const rawName = (isCustomEntity ? storedLabel : entity?.name)?.trim();
  const label = entityTypeLabel(entityType).toLowerCase();
  const displayName =
    rawName && rawName.length > 0 ? rawName : `Untitled ${label} #${entityId}`;

  const allMessages = results.flatMap((r) =>
    r.messages.map((m) => ({ ...m, languageCode: r.languageCode }))
  );

  const editEntityHref = isProduct
    ? `/products/${entityId}`
    : isCollection
    ? `/collections/${entityId}`
    : storedUrl;

  return (
    <Page pageId="content-health-issue-detail">
      <PageTitle>
        {entityQuery.isLoading
          ? 'Loading…'
          : entityNotFound
          ? 'Not found'
          : displayName}
      </PageTitle>
      <PageActionBar>
        <PageActionBarRight>
          {editEntityHref && (
            <Button
              type="button"
              variant="outline"
              render={<Link to={editEntityHref} />}
            >
              <ExternalLinkIcon className="h-4 w-4 mr-2" />
              Go to {label}
            </Button>
          )}
          {!isCustomEntity && (
            <Button
              type="button"
              disabled={checkNowMutation.isPending || entityNotFound}
              onClick={() => checkNowMutation.mutate()}
            >
              <RefreshCwIcon
                className={`h-4 w-4 mr-2 ${
                  checkNowMutation.isPending ? 'animate-spin' : ''
                }`}
              />
              {checkNowMutation.isPending ? 'Checking…' : 'Check now'}
            </Button>
          )}
        </PageActionBarRight>
      </PageActionBar>
      <PageLayout>
        <PageBlock column="main" blockId="content-health-issue-findings">
          {entityNotFound ? (
            <p className="text-sm text-muted-foreground">
              This {label} could not be found — it may have been deleted since
              it was last checked.
            </p>
          ) : resultsQuery.isLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-8 bg-muted rounded-md" />
              <div className="h-8 bg-muted rounded-md" />
            </div>
          ) : (
            <div className="space-y-3">
              {isCustomEntity && (
                <p className="text-sm text-muted-foreground">
                  This is a custom entity type ({entityType}), checked as part
                  of the full scan. It has no manual re-check.
                </p>
              )}
              <ContentCheckFindingsList messages={allMessages} />
            </div>
          )}
        </PageBlock>
      </PageLayout>
    </Page>
  );
}

export const contentCheckIssueDetailRoute: DashboardRouteDefinition = {
  path: '/content-health/issues/$entityType/$entityId',
  loader: () => ({
    breadcrumb: [
      { path: '/content-health/issues', label: 'SEO / content issues' },
      'Issue',
    ],
  }),
  component: (route) => <ContentCheckIssueDetailPage route={route} />,
};
