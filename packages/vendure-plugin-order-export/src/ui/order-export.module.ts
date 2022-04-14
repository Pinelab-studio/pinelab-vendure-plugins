import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { addNavMenuItem, SharedModule } from '@vendure/admin-ui/core';
import { OrderExportComponent } from './order-export.component';

@NgModule({
  imports: [
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        pathMatch: 'full',
        component: OrderExportComponent,
        data: { breadcrumb: 'Order export' },
      },
    ]),
  ],
  providers: [],
  declarations: [OrderExportComponent],
})
export class OrderExportModule {}
