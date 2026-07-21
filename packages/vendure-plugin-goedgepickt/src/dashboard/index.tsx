import { defineDashboardExtension } from '@vendure/dashboard';
import { PushToGoedgepicktMenuItem } from './components/PushToGoedgepicktMenuItem';
import { GoedgepicktFullSyncMenuItem } from './components/GoedgepicktFullSyncMenuItem';

defineDashboardExtension({
  actionBarItems: [
    {
      pageId: 'order-detail',
      type: 'dropdown',
      requiresPermission: 'UpdateOrder',
      component: ({ context }) => (
        <PushToGoedgepicktMenuItem context={context} />
      ),
    },
    {
      pageId: 'product-list',
      type: 'dropdown',
      requiresPermission: 'SetGoedgepicktConfig',
      component: () => <GoedgepicktFullSyncMenuItem />,
    },
  ],
});
