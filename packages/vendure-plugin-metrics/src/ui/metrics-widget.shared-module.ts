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
    registerDashboardWidget('advanced-metrics', {
      title: 'Advanced metrics',
      supportedWidths: [6, 8, 12],
      loadComponent: () =>
        import('./metrics-widget').then((m) => m.MetricsWidgetComponent),
    }),
    setDashboardWidgetLayout([{ id: 'advanced-metrics', width: 12 }]),
  ],
})
export class MetricsWidgetSharedModule {}
