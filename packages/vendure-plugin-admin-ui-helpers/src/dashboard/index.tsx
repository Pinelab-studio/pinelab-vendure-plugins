import { defineDashboardExtension } from '@vendure/dashboard';
import { CancelOrderButton } from './components/CancelOrderButton';
import { CompleteOrderButton } from './components/CompleteOrderButton';

defineDashboardExtension({
  actionBarItems: [
    {
      pageId: 'order-detail',
      component: ({ context }) => <CancelOrderButton context={context} />,
    },
    {
      pageId: 'order-detail',
      component: ({ context }) => <CompleteOrderButton context={context} />,
    },
  ],
  pageBlocks: [],
});
