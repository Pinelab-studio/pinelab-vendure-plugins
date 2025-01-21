import { registerRouteComponent } from '@vendure/admin-ui/core';
import { PDFTemplateListComponent } from './pdf-template-list.component';

export default [
  registerRouteComponent({
    path: '',
    title: 'PDF Templates',
    component: PDFTemplateListComponent,
    breadcrumb: 'PDF Templates',
  }),
];
