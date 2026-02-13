import { Button, useLocalFormat } from '@vendure/dashboard';
import { Wallet } from '../../api/generated/graphql';
import React, { useState } from 'react';
import WalletAdjustmentCard from './WalletAdjustmentCard';
import { WalletAdjustmentDialog } from './WalletAdjustmentDialog';
import { useWalletAdjustmentList } from './use-wallet-adjustment';
import { Trans } from '@lingui/react/macro';
import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/vdb/components/ui/alert.js';

interface WalletCardProps {
  wallet: Wallet;
}

const WalletCard: React.FC<WalletCardProps> = ({ wallet }) => {
  const [isEditing, setIsEditing] = useState(false);
  const { formatCurrency } = useLocalFormat();
  const { adjustments, hasNextPage, fetchNextPage, error } =
    useWalletAdjustmentList({ walletId: wallet.id, pageSize: 10 });
  return (
    <div className="w-[350px] flex flex-col overflow-hidden border border-border rounded-md text-sm">
      <div className="p-4 border-b border-border">
        <div className="flex justify-between items-center">
          <h2 className="m-0 text-sm font-semibold">{wallet.name}</h2>
          <WalletAdjustmentDialog
            open={isEditing}
            onOpenChange={setIsEditing}
            walletId={wallet.id}
            currencyCode={wallet.currencyCode}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                setIsEditing(true);
                e.preventDefault();
              }}
            >
              Adjust Balance
            </Button>
          </WalletAdjustmentDialog>
        </div>
        <div className="mt-2 text-lg font-semibold">
          {formatCurrency(wallet.balance, wallet.currencyCode)}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>
            <Trans>Error loading wallet adjustments: {error.message}</Trans>
          </AlertDescription>
        </Alert>
      )}

      <div className="max-h-[200px] overflow-y-auto p-4 min-h-[120px]">
        <p className="text-xs font-medium uppercase mb-3 text-muted-foreground">
          Activity Log
        </p>
        {adjustments.length > 0 ? (
          adjustments.map((adj) => (
            <WalletAdjustmentCard
              key={adj.id}
              adjustment={adj}
              currencyCode={wallet.currencyCode}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-sm">
            <span className="text-2xl mb-2">∅</span>
            <p className="m-0 text-center">
              No transactions found for this wallet.
            </p>
          </div>
        )}
        {hasNextPage && (
          <Button
            type="button"
            variant="outline"
            onClick={() => fetchNextPage()}
            className="w-full mt-4 flex items-center justify-center py-2 text-sm font-medium text-gray-600 dark:text-slate-400 bg-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-md transition-all active:scale-[0.98]"
          >
            <Trans>Load more</Trans>
          </Button>
        )}
      </div>
    </div>
  );
};

export default WalletCard;
