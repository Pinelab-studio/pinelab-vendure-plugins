import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '@vendure/admin-ui/core';
import { InvoicesComponent } from './invoices.component';

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
  declarations: [InvoicesComponent],
})
export class InvoicesModule {}
