import { NgModule } from '@angular/core';
import {
  registerDashboardWidget,
  setDashboardWidgetLayout,
} from '@vendure/admin-ui/core';
import { MetricsWidgetModule } from './metrics-widget.module';

@NgModule({
  imports: [MetricsWidgetModule],
  declarations: [],
  providers: [
    registerDashboardWidget('product-metrics', {
      title: 'Product Metrics',
      supportedWidths: [4, 6, 8, 12],
      loadComponent: () =>
        import('./product-metrics-widget').then(
          (m) => m.ProductMetricsWidgetComponent
        ),
    }),
    registerDashboardWidget('order-metrics', {
      title: 'Order Metrics',
      supportedWidths: [4, 6, 8, 12],
      loadComponent: () =>
        import('./order-metrics-widget').then(
          (m) => m.OrderMetricsWidgetComponent
        ),
    }),
    setDashboardWidgetLayout([{ id: 'product-metrics', width: 12 }]),
    setDashboardWidgetLayout([{ id: 'order-metrics', width: 12 }]),
  ],
})
export class MetricsWidgetSharedModule {}
