import { Wallet } from '../../api/generated/graphql';
import WalletCard from './WalletCard';
import { graphql } from '@/vdb/graphql/graphql';
import { api } from '@/vdb/graphql/api.js';
import { useQuery } from '@tanstack/react-query';

export const GET_WALLET_WITH_ADJUSTMENTS = graphql(`
  query GetCustomerWithWallets($id: ID!) {
    customer(id: $id) {
      id
      wallets {
        items {
          id
          name
          createdAt
          updatedAt
          currencyCode
          balance
          name
          adjustments {
            id
            createdAt
            amount
            description
            mutatedBy {
              id
              identifier
            }
          }
        }
        totalItems
      }
    }
  }
`);

interface WalletListProps {
  customerId: string;
}
const WalletList: React.FC<WalletListProps> = ({ customerId }) => {
  const { data: customerData, isLoading } = useQuery({
    queryKey: ['customer'],
    queryFn: () => {
      return api.query(GET_WALLET_WITH_ADJUSTMENTS, { id: customerId });
    },
    retry: false,
  });
  const wallets = (customerData?.customer?.wallets as any)?.items as Wallet[];
  return isLoading ? (
    <div className="animate-pulse space-y-2">
      <div className="h-16 bg-muted rounded-md w-[350px]" />
    </div>
  ) : (
    <div className="flex flex-wrap gap-4">
      {wallets.map((w) => (
        <WalletCard key={w.id} wallet={w} />
      ))}
    </div>
  );
};
export default WalletList;
