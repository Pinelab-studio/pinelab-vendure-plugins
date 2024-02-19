import { NgModule } from '@angular/core';
import { addNavMenuItem, SharedModule } from '@vendure/admin-ui/core';

@NgModule({
  imports: [SharedModule],
  providers: [
    addNavMenuItem(
      {
        id: 'export-orders',
        label: 'Export orders',
        routerLink: ['/extensions/export-orders'],
        icon: 'download',
        requiresPermission: 'ExportOrders',
      },
      'sales',
    ),
  ],
})
export class OrderExportNavModule {}
