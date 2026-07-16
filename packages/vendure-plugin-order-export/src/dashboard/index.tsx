import { defineDashboardExtension } from '@vendure/dashboard';
import { orderExportRoute } from './components/OrderExportPage';

defineDashboardExtension({
  routes: [orderExportRoute],
});
