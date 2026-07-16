import { defineDashboardExtension } from '@vendure/dashboard';
import { ConvertToDraftMenuItem } from './components/ConvertToDraftMenuItem';

defineDashboardExtension({
  actionBarItems: [
    {
      pageId: 'order-detail',
      type: 'dropdown',
      requiresPermission: 'CreateOrder',
      component: ({ context }) => <ConvertToDraftMenuItem context={context} />,
    },
  ],
});
