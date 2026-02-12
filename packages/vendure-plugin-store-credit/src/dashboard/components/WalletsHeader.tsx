import { Button } from '@vendure/dashboard';
import { Plus } from 'lucide-react';
import { CreateWalletDialog } from './CreateWalletDialog';

const CustomerWalletsHeader = () => {
  return (
    <div className="flex items-center justify-between w-full pb-4 mb-4 border-b border-border">
      <h1 className="text-lg font-semibold">Customer Wallets</h1>
      <CreateWalletDialog>
        <Button type="button" size="sm">
          <Plus className="size-4" />
          Create Wallet
        </Button>
      </CreateWalletDialog>
    </div>
  );
};

export default CustomerWalletsHeader;
