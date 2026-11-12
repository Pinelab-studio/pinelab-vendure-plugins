import { Link } from '@tanstack/react-router';
import { api, Button, defineDashboardExtension } from '@vendure/dashboard';
import {
  CollectionContentCheckFindingsBlock,
  ProductContentCheckFindingsBlock,
} from './components/ContentCheckFindingsBlock';
import { contentCheckIssueDetailRoute } from './components/ContentCheckIssueDetailPage';
import { contentCheckIssuesListRoute } from './components/ContentCheckIssuesListPage';
import { ContentCheckOverviewWidget } from './components/ContentCheckOverviewWidget';
import { contentCheckOverviewForAlertDocument } from './queries';

defineDashboardExtension({
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
    },
    {
      id: 'content-health-findings',
      location: {
        pageId: 'collection-detail',
        column: 'main',
        position: { blockId: 'main-form', order: 'after' },
      },
      component: CollectionContentCheckFindingsBlock,
    },
  ],
  widgets: [
    {
      id: 'content-health-overview',
      name: 'Content issues',
      component: ContentCheckOverviewWidget,
      defaultSize: { w: 6, h: 4 },
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
});
