import { defineDashboardExtension } from '@vendure/dashboard';
import { PushToGoedgepicktMenuItem } from './components/PushToGoedgepicktMenuItem';

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
  ],
});
