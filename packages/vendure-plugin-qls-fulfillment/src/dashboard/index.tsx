import { defineDashboardExtension } from '@vendure/dashboard';

import { AddAdditionalEanButton } from './components/AddAdditionalEanButton';
import { PushOrderToQlsMenuItem } from './components/PushOrderToQlsMenuItem';
import { SyncProductsMenuItem } from './components/SyncProductsMenuItem';
import { VisitQlsOrderButton } from './components/VisitQlsOrderButton';
import { VisitQlsProductButton } from './components/VisitQlsProductButton';

/**
 * React Dashboard extension for the QLS fulfillment plugin.
 *
 * Replicates the legacy Angular action-bar items as dashboard action bar items.
 */
defineDashboardExtension({
  actionBarItems: [
    {
      id: 'qls-sync-products',
      pageId: 'product-list',
      type: 'dropdown',
      requiresPermission: 'QLSFullSync',
      component: () => <SyncProductsMenuItem />,
    },
    {
      id: 'qls-visit-order',
      pageId: 'order-detail',
      component: ({ context }) => <VisitQlsOrderButton context={context} />,
    },
    {
      id: 'qls-push-order',
      pageId: 'order-detail',
      type: 'dropdown',
      requiresPermission: 'QLSPushOrder',
      component: ({ context }) => <PushOrderToQlsMenuItem context={context} />,
    },
    {
      id: 'qls-visit-product',
      pageId: 'product-variant-detail',
      component: ({ context }) => <VisitQlsProductButton context={context} />,
    },
    {
      id: 'qls-add-ean',
      pageId: 'product-variant-detail',
      // NOTE: intentionally not `type: 'dropdown'`, see AddAdditionalEanButton
      requiresPermission: 'QLSFullSync',
      component: ({ context }) => <AddAdditionalEanButton context={context} />,
    },
  ],
});
