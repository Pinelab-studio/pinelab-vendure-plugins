import { MetricsWidgetComponent } from './metrics-widget';
import { SharedModule } from '@vendure/admin-ui/core';
import { NgModule } from '@angular/core';
@NgModule({
  imports: [SharedModule],
  declarations: [MetricsWidgetComponent],
})
export class MetricsWidgetModule {}
