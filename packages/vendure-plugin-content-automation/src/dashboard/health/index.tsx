import { Link } from '@tanstack/react-router';
import { api, Button, DashboardExtension } from '@vendure/dashboard';
import { CONTENT_HEALTH_PERMISSION } from '../permissions';
import {
  CollectionContentCheckFindingsBlock,
  ProductContentCheckFindingsBlock,
} from './components/ContentCheckFindingsBlock';
import { contentCheckIssueDetailRoute } from './components/ContentCheckIssueDetailPage';
import { contentCheckIssuesListRoute } from './components/ContentCheckIssuesListPage';
import { ContentCheckOverviewWidget } from './components/ContentCheckOverviewWidget';
import {
  contentCheckOverviewForAlertDocument,
  dashboardPermissionsDocument,
} from './queries';

/**
 * The content health Dashboard UI uses Vendure's built-in ReadProduct permission.
 */
export const contentHealthDashboardExtension: DashboardExtension = {
  routes: [contentCheckIssuesListRoute, contentCheckIssueDetailRoute],
  pageBlocks: [
    {
      id: 'content-health-findings',
      location: {
        pageId: 'product-detail',
        column: 'main',
        position: { blockId: 'main-form', order: 'after' },
      },
      component: ProductContentCheckFindingsBlock,
      requiresPermission: CONTENT_HEALTH_PERMISSION,
    },
    {
      id: 'content-health-findings',
      location: {
        pageId: 'collection-detail',
        column: 'main',
        position: { blockId: 'main-form', order: 'after' },
      },
      component: CollectionContentCheckFindingsBlock,
      requiresPermission: CONTENT_HEALTH_PERMISSION,
    },
  ],
  widgets: [
    {
      id: 'content-health-overview',
      name: 'Content issues',
      component: ContentCheckOverviewWidget,
      defaultSize: { w: 6, h: 4 },
      requiresPermissions: [CONTENT_HEALTH_PERMISSION],
    },
  ],
  alerts: [
    {
      id: 'content-health-errors',
      // `data` is `undefined` until the `check()` query first resolves (the
      // Alerts framework calls these with `result.data` straight from
      // react-query, which starts out undefined), so every callback here
      // must tolerate that.
      title: (data: number | undefined) =>
        `${data ?? 0} content issue${data === 1 ? '' : 's'}`,
      description: '',
      severity: 'error',
      check: async () => {
        // Alerts have no permission option, so check access before querying.
        if (!(await hasContentHealthPermission())) {
          return 0;
        }
        const result = await api.query(contentCheckOverviewForAlertDocument, {
          options: {
            take: 0,
            filter: { hasError: { eq: true } },
          },
        });
        return result.contentCheckOverview.totalItems;
      },
      shouldShow: (data: number | undefined) => (data ?? 0) > 0,
      actions: [
        {
          component: ({ dismiss }) => (
            <Button
              render={<Link to="/content-health/issues" onClick={dismiss} />}
              size="sm"
            >
              View all issues
            </Button>
          ),
        },
      ],
    },
  ],
};

/**
 * Whether the administrator has ReadProduct permission in the active channel
 */
async function hasContentHealthPermission(): Promise<boolean> {
  const { me, activeChannel } = await api.query(dashboardPermissionsDocument);
  return !!me?.channels
    .find((channel) => channel.id === activeChannel.id)
    ?.permissions.includes(CONTENT_HEALTH_PERMISSION as never);
}
