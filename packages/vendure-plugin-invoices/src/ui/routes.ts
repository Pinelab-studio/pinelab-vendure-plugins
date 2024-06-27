import { registerRouteComponent, addNavMenuItem } from '@vendure/admin-ui/core';
import { InvoiceListComponent } from './invoice-list/invoice-list.component';

export default [
  registerRouteComponent({
    path: '',
    component: InvoiceListComponent,
    breadcrumb: 'Invoices',
  }),
];
