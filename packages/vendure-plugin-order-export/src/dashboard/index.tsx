import { defineDashboardExtension } from '@vendure/dashboard';
import { OrderExportComponent } from './components/OrderExport';

defineDashboardExtension({
  routes: [
    {
      path: '/export-orders',
      component: OrderExportComponent,
      navMenuItem: {
        sectionId: 'sales',
        id: 'export-orders',
        title: 'Export orders',
        url: '/export-orders',
      },
    },
  ],
});
