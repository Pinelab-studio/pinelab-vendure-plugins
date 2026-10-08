import {
  api,
  Badge,
  Button,
  DashboardRouteDefinition,
  DetailPageButton,
  ListPage,
  PageActionBarRight,
} from '@vendure/dashboard';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnyRoute, Link } from '@tanstack/react-router';
import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
} from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { entityTypeLabel } from '../entity-type-label';
import {
  contentCheckEntityTypesDocument,
  contentCheckOverviewListDocument,
  runContentHealthFullScanDocument,
} from '../queries';

/**
 * `entityType` is passed through verbatim (not case-folded) since a custom
 * entity type from `additionalChecks` can be any casing the site owner
 * chose, and the issue detail route matches it exactly against the stored
 * value. `entityId` is also encoded since a custom entity's id is an
 * arbitrary site-owner-chosen string, not necessarily URL-safe.
 */
function issueDetailHref(entityType: string, entityId: string): string {
  return `/content-health/issues/${encodeURIComponent(
    entityType
  )}/${encodeURIComponent(entityId)}`;
}

function ContentCheckIssuesListPage({ route }: { route: AnyRoute }) {
  const queryClient = useQueryClient();
  const refreshListRef = useRef<(() => void) | undefined>(undefined);

  const runFullScanMutation = useMutation({
    mutationFn: () => api.mutate(runContentHealthFullScanDocument, {}),
    onSuccess: async (data) => {
      const result = data.runContentHealthFullScan;
      toast.success(
        `Full scan complete: ${result.entitiesChecked} ${
          result.entitiesChecked === 1 ? 'entity' : 'entities'
        } checked across ${result.channelsScanned} ${
          result.channelsScanned === 1 ? 'channel' : 'channels'
        }.`
      );
      await queryClient.invalidateQueries({
        queryKey: ['content-health-overview'],
      });
      refreshListRef.current?.();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : 'Full scan failed'),
  });

  return (
    <ListPage
      pageId="content-health-issues-list"
      title="SEO / content issues"
      listQuery={contentCheckOverviewListDocument}
      route={route}
      registerRefresher={(refreshFn) => {
        refreshListRef.current = refreshFn;
      }}
      onSearchTermChange={(term) => ({ name: { contains: term } })}
      facetedFilters={{
        entityType: {
          title: 'Type',
          // Loaded dynamically rather than hardcoded to 'PRODUCT'/'COLLECTION',
          // since `additionalChecks` can report arbitrary custom entity types.
          optionsFn: async () => {
            const result = await api.query(contentCheckEntityTypesDocument, {});
            return result.contentCheckEntityTypes.map((entityType) => ({
              label: entityTypeLabel(entityType),
              value: entityType,
            }));
          },
        },
        hasError: {
          title: 'Severity',
          options: [
            { label: 'Has errors', value: true },
            { label: 'Warnings only', value: false },
          ],
        },
      }}
      customizeColumns={{
        name: {
          // `entityId` is otherwise a hidden column, and the list query is
          // optimized to only fetch fields backing visible columns — without
          // this, `row.original.entityId` (used below) would be `undefined`
          // and both this link and the "go to entity" button would break.
          meta: { dependencies: ['entityId'] },
          cell: ({ row }) => (
            <DetailPageButton
              href={issueDetailHref(
                row.original.entityType,
                row.original.entityId
              )}
              label={row.original.name}
            />
          ),
        },
        entityType: {
          header: 'Type',
          cell: ({ row }) => (
            <span className="text-muted-foreground">
              {entityTypeLabel(row.original.entityType)}
            </span>
          ),
        },
        hasError: {
          header: 'Status',
          meta: { dependencies: ['hasWarning', 'errorCount', 'warningCount'] },
          cell: ({ row }) => (
            <div className="flex gap-1 flex-wrap">
              {row.original.hasError && (
                <Badge variant="destructive">
                  {row.original.errorCount} error
                  {row.original.errorCount === 1 ? '' : 's'}
                </Badge>
              )}
              {row.original.hasWarning && (
                <Badge variant="outline">
                  {row.original.warningCount} warning
                  {row.original.warningCount === 1 ? '' : 's'}
                </Badge>
              )}
            </div>
          ),
        },
        hasWarning: { meta: { disabled: true } },
        errorCount: { meta: { disabled: true } },
        warningCount: { meta: { disabled: true } },
        url: { meta: { disabled: true } },
        preview: {
          header: 'Preview',
          cell: ({ row }) => (
            <span
              className="block max-w-md truncate text-sm text-muted-foreground"
              title={row.original.preview ?? undefined}
            >
              {row.original.preview ?? '—'}
            </span>
          ),
        },
        languageCodes: {
          header: 'Languages',
          cell: ({ row }) => (
            <div className="flex flex-wrap gap-1">
              {row.original.languageCodes.map((languageCode) => (
                <Badge key={languageCode} variant="outline">
                  {languageCode}
                </Badge>
              ))}
            </div>
          ),
        },
      }}
      additionalColumns={{
        goToEntity: {
          header: '',
          // `url` is otherwise a hidden column — see the `name` column's
          // comment above for why this is required.
          meta: { dependencies: ['url'] },
          cell: ({ row }) => {
            const url = row.original.url;
            if (!url) {
              return null;
            }
            const label = `Go to ${entityTypeLabel(
              row.original.entityType
            ).toLowerCase()}`;
            return (
              <Button
                variant="ghost"
                size="icon"
                title={label}
                render={<Link to={url} />}
              >
                <ExternalLinkIcon className="h-4 w-4" />
                <span className="sr-only">{label}</span>
              </Button>
            );
          },
        },
      }}
      defaultColumnOrder={[
        'name',
        'entityType',
        'hasError',
        'preview',
        'languageCodes',
        'goToEntity',
      ]}
      defaultVisibility={{
        name: true,
        entityType: true,
        hasError: true,
        preview: true,
        languageCodes: true,
        goToEntity: true,
      }}
      defaultSort={[{ id: 'hasError', desc: true }]}
    >
      <PageActionBarRight>
        <Button
          type="button"
          disabled={runFullScanMutation.isPending}
          onClick={() => runFullScanMutation.mutate()}
        >
          <RefreshCwIcon
            className={`h-4 w-4 mr-2 ${
              runFullScanMutation.isPending ? 'animate-spin' : ''
            }`}
          />
          {runFullScanMutation.isPending ? 'Scanning…' : 'Run full scan now'}
        </Button>
      </PageActionBarRight>
    </ListPage>
  );
}

export const contentCheckIssuesListRoute: DashboardRouteDefinition = {
  path: '/content-health/issues',
  loader: () => ({ breadcrumb: 'SEO / content issues' }),
  component: (route) => <ContentCheckIssuesListPage route={route} />,
  navMenuItem: {
    sectionId: 'catalog',
    id: 'content-health-issues',
    title: 'SEO / content issues',
    icon: AlertTriangleIcon,
  },
};
