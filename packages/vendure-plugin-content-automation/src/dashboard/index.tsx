import { defineDashboardExtension } from '@vendure/dashboard';
import { contentAutomationUpdateListRoute } from './components/ContentAutomationUpdateListPage';

defineDashboardExtension({
  routes: [contentAutomationUpdateListRoute],
});
