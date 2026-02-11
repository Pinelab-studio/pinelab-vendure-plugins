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
  console.log(wallets?.[0]?.adjustments, 'wallets');
  return isLoading ? (
    'Loading'
  ) : (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
      {wallets.map((w) => (
        <WalletCard key={w.id} wallet={w} />
      ))}
    </div>
  );
};
export default WalletList;
