import { NgModule } from '@angular/core';
import {
  registerDashboardWidget,
  setDashboardWidgetLayout,
} from '@vendure/admin-ui/core';
import { MetricsWidgetModule } from './metrics-widget';

@NgModule({
  imports: [MetricsWidgetModule],
  declarations: [],
  providers: [
    registerDashboardWidget('product metrics', {
      title: 'Metrics',
      supportedWidths: [4, 6, 8, 12],
      loadComponent: () =>
        import('./metrics-widget').then((m) => m.MetricsWidgetComponent),
    }),
    setDashboardWidgetLayout([{ id: 'metrics', width: 12 }]),
  ],
})
export class MetricsWidgetSharedModule {}
