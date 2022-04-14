import { NgModule } from '@angular/core';
import { addNavMenuItem, SharedModule } from '@vendure/admin-ui/core';

@NgModule({
  imports: [SharedModule],
  providers: [
    addNavMenuItem(
      {
        id: 'order-export',
        label: 'Export Orders',
        routerLink: ['/extensions/order-export'],
        icon: 'export',
        requiresPermission: 'ExportOrders',
      },
      'sales'
    ),
  ],
})
export class OrderExportNavModule {}
