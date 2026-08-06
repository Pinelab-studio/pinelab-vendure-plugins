import {
  ActionBarItem,
  Button,
  DashboardRouteDefinition,
  ListPage,
  useLocalFormat,
} from '@vendure/dashboard';
import { graphql } from '@/vdb/graphql/graphql';
import { Trans } from '@lingui/react/macro';
import { GiftCardWalletDetailSheet } from './GiftCardWalletDetailSheet';
import { Wallet } from '../../api/generated/graphql';
import { Plus } from 'lucide-react';
import { CreateGiftCardDialog } from './CreateGiftCardDialog';

export const getWalletList = graphql(`
  query GetWallets($options: WalletListOptions) {
    giftCardWallets(options: $options) {
      items {
        id
        createdAt
        updatedAt
        name
        code
        balance
        currencyCode
      }
      totalItems
    }
  }
`);

const WalletListInner = ({ route }: { route: any }) => {
  const { formatCurrency } = useLocalFormat();

  return (
    <ListPage
      pageId="wallet-list"
      title="Gift Card Wallets"
      listQuery={getWalletList}
      route={route}
      customizeColumns={{
        name: {
          cell: ({ row, cell }) => {
            const value = cell.getValue();
            const wallet: Wallet = row.original;
            if (!value) {
              return null;
            }
            return (
              <div className="flex flex-wrap gap-2 items-center">
                <GiftCardWalletDetailSheet wallet={wallet}>
                  <Trans>{wallet.name}</Trans>
                </GiftCardWalletDetailSheet>
              </div>
            );
          },
        },
        balance: {
          cell: ({ row }) => {
            const { balance, currencyCode } = row.original;
            return (
              <span className={balance <= 0 ? 'text-destructive' : undefined}>
                {formatCurrency(balance, currencyCode)}
              </span>
            );
          },
        },
      }}
    >
      <ActionBarItem itemId="create-gift-card">
        <CreateGiftCardDialog>
          <Button type="button">
            <Plus className="size-4" />
            Create Gift Card
          </Button>
        </CreateGiftCardDialog>
      </ActionBarItem>
    </ListPage>
  );
};

export const giftCardWalletList: DashboardRouteDefinition = {
  navMenuItem: {
    sectionId: 'marketing',
    id: 'gift-card-wallets',
    url: '/gift-card-wallets',
    title: 'Gift Cards',
  },
  path: '/gift-card-wallets',
  loader: () => ({
    breadcrumb: 'Gift Cards',
  }),
  component: (route) => <WalletListInner route={route} />,
};
