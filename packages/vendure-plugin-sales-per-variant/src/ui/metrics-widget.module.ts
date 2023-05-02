import { ProductMetricsWidgetComponent } from './product-metrics-widget';
import { SharedModule } from '@vendure/admin-ui/core';
import { NgModule } from '@angular/core';
import { OrderMetricsWidgetComponent } from './order-metrics-widget';
@NgModule({
  imports: [SharedModule],
  declarations: [ProductMetricsWidgetComponent, OrderMetricsWidgetComponent],
})
export class MetricsWidgetModule {}
