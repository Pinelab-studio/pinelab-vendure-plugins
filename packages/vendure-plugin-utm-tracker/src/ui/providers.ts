import { registerCustomDetailComponent } from '@vendure/admin-ui/core';
import { UtmOrderComponent } from './order-utm.component';

export default [
  registerCustomDetailComponent({
    locationId: 'order-detail',
    component: UtmOrderComponent,
  }),
];
