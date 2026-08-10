import { defineDashboardExtension } from '@vendure/dashboard';
import { LoadGoogleSheetMenuItem } from './components/LoadGoogleSheetMenuItem';

defineDashboardExtension({
  actionBarItems: [
    {
      pageId: 'product-list',
      type: 'dropdown',
      requiresPermission: 'UpdateProduct',
      component: () => <LoadGoogleSheetMenuItem />,
    },
  ],
});
