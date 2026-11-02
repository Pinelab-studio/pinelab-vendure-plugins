import { Button } from '@vendure/dashboard';
import { Plus } from 'lucide-react';
import { CreateWalletDialog } from './CreateWalletDialog';

const CustomerWalletsHeader = () => {
  return (
    <div className="flex w-full items-center justify-between">
      <h1 className="font-semibold">Store Credit Wallets</h1>
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
