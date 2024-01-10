import { registerCustomDetailComponent } from '@vendure/admin-ui/core';
import { SuggestedFacetsComponent } from './suggested-facets-component/suggested-facets.component';
export default [
  registerCustomDetailComponent({
    locationId: 'product-detail',
    component: SuggestedFacetsComponent,
  }),
];
