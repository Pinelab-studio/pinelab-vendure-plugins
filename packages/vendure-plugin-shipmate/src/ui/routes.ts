import { registerRouteComponent } from '@vendure/admin-ui/core';
import { ShipmateComponent } from './shipmate.component';

export default [
  registerRouteComponent({
    path: '',
    component: ShipmateComponent,
    breadcrumb: 'Shipmate',
  }),
];
