import { defineDashboardExtension } from '@vendure/dashboard';
import { LowStockWidget } from './components/LowStockWidget';

defineDashboardExtension({
  widgets: [
    {
      id: 'low-stock',
      name: 'Low stock',
      component: LowStockWidget,
      defaultSize: { w: 6, h: 4 },
    },
  ],
});
