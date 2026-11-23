import { defineDashboardExtension } from '@vendure/dashboard';
import { contentAutomationUpdateListRoute } from './components/ContentAutomationUpdateListPage';
import { contentHealthDashboardExtension } from './health';

/**
 * The Dashboard UI of a feature is only shown to administrators with that feature's permission.
 * A disabled feature doesn't register its permission, so its UI is hidden for everyone.
 */
defineDashboardExtension({
  routes: [contentAutomationUpdateListRoute],
});

defineDashboardExtension(contentHealthDashboardExtension);
