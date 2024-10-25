import { registerRouteComponent } from '@vendure/admin-ui/core';

import { CampaignListComponent } from './components/campaign-list.component';

export default [
  registerRouteComponent({
    path: '',
    component: CampaignListComponent,
    breadcrumb: 'Campaigns',
  }),
];
