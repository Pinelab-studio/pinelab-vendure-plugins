import { MetricsWidgetComponent } from './metrics-widget';
import { SharedModule } from '@vendure/admin-ui/core';
import { NgModule } from '@angular/core';
import { ChartistComponent } from './chartist/chartist.component';
@NgModule({
  imports: [SharedModule],
  declarations: [MetricsWidgetComponent, ChartistComponent],
})
export class MetricsWidgetModule {}
