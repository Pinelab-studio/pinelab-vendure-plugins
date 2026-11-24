import { defineDashboardExtension } from '@vendure/dashboard';
import { contentAutomationUpdateListRoute } from './components/ContentAutomationUpdateListPage';
import { RunContentAutomationsButton } from './components/RunContentAutomationsButton';
import { contentHealthDashboardExtension } from './health';
import { CONTENT_AUTOMATION_PERMISSION } from './permissions';

/**
 * Dashboard access uses built-in Vendure permissions, independently of which backend features are enabled.
 */
defineDashboardExtension({
  routes: [contentAutomationUpdateListRoute],
  pageBlocks: [
    {
      id: 'content-automation',
      title: 'Content automation',
      location: {
        pageId: 'product-detail',
        column: 'main',
        position: { blockId: 'main-form', order: 'after' },
      },
      requiresPermission: CONTENT_AUTOMATION_PERMISSION,
      component: ({ context }) => {
        const productId = context.entity?.id;
        return productId ? (
          <RunContentAutomationsButton productId={productId as string} />
        ) : null;
      },
    },
  ],
});

defineDashboardExtension(contentHealthDashboardExtension);
