import { defineDashboardExtension } from '@vendure/dashboard';
import { PullStockFromGoedgepicktButton } from './components/PullStockFromGoedgepicktButton';
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
    {
      pageId: 'product-detail',
      requiresPermission: 'UpdateProduct',
      component: ({ context }) => (
        <PullStockFromGoedgepicktButton context={context} />
      ),
    },
  ],
});
