import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '@vendure/admin-ui/core';
import { InvoicesComponent } from './invoices.component';
import { InvoiceDetailViewComponent } from './invoices-detail-view/invoices-detail-view.component';

@NgModule({
  imports: [
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        pathMatch: 'full',
        component: InvoicesComponent,
        data: { breadcrumb: 'Invoices' },
      },
    ]),
  ],
  providers: [],
  declarations: [InvoicesComponent, InvoiceDetailViewComponent],
})
export class InvoicesModule {}
