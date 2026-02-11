import { Plus } from 'lucide-react';
import { CreateWalletDialog } from './CreateWalletDialog';

const CustomerWalletsHeader = () => {
  return (
    <div className="flex items-center justify-between w-full pb-5 mb-6 border-b border-gray-100">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-slate-50">
          Customer Wallets
        </h1>
      </div>

      <CreateWalletDialog>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
        >
          <Plus size={16} strokeWidth={2.5} />
          Create Wallet
        </button>
      </CreateWalletDialog>
    </div>
  );
};

export default CustomerWalletsHeader;
