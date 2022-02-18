import { NgModule } from '@angular/core';
import { addNavMenuItem, SharedModule } from '@vendure/admin-ui/core';

@NgModule({
  imports: [SharedModule],
  providers: [
    addNavMenuItem(
      {
        id: 'invoices',
        label: 'Invoices',
        routerLink: ['/extensions/invoices'],
        icon: 'file-group',
        requiresPermission: 'AllowInvoicesPermission',
      },
      'sales'
    ),
  ],
})
export class InvoicesNavModule {}
