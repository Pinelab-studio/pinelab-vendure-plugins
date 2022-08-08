import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '@vendure/admin-ui/core';
import { OrderExportComponent } from './order-export.component';

@NgModule({
  imports: [
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        pathMatch: 'full',
        component: OrderExportComponent,
        data: { breadcrumb: 'Export orders' },
      },
    ]),
  ],
  providers: [],
  declarations: [OrderExportComponent],
})
export class OrderExportModule {}
