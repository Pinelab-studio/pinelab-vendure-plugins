import { registerCustomDetailComponent } from '@vendure/admin-ui/core';
import { SelectableFacetsComponent } from './selectable-facets-component/selectable-facets.component';
export default [
  registerCustomDetailComponent({
    locationId: 'product-detail',
    component: SelectableFacetsComponent,
  }),
];
