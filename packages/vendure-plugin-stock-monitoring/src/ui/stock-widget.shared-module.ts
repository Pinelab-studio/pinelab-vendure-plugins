import { NgModule } from '@angular/core';
import {
  registerDashboardWidget,
  setDashboardWidgetLayout,
} from '@vendure/admin-ui/core';
import { StockWidgetModule } from './stock-widget';

@NgModule({
  imports: [StockWidgetModule],
  declarations: [],
  providers: [
    registerDashboardWidget('stock-levels', {
      title: 'Low stock',
      supportedWidths: [4, 6, 8, 12],
      loadComponent: () =>
        import('./stock-widget').then((m) => m.StockWidgetComponent),
    }),
    setDashboardWidgetLayout([
      { id: 'welcome', width: 12 },
      { id: 'orderSummary', width: 6 },
      { id: 'reviews', width: 6 },
      { id: 'latestOrders', width: 12 },
    ]),
  ],
})
export class StockWidgetSharedModule {}
