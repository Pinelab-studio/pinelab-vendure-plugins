import { defineDashboardExtension } from '@vendure/dashboard';
import WalletList from './components/WalletList';
import WalletsHeader from './components/WalletsHeader';

defineDashboardExtension({
  pageBlocks: [
    {
      id: 'customer-wallets',
      component: ({ context }) => {
        return <WalletList customerId={context.entity?.id as string} />;
      },
      title: WalletsHeader(),
      location: {
        pageId: 'customer-detail',
        column: 'main',
        position: { blockId: 'addresses', order: 'after' },
      },
    },
  ],
});
