import { Trans } from '@lingui/react/macro';
import { Button, useLocalFormat } from '@vendure/dashboard';
import { TriangleAlert } from 'lucide-react';
import React, { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { Alert, AlertDescription } from '@/vdb/components/ui/alert.js';
import { Wallet } from '../../api/generated/graphql';
import { useWalletAdjustmentList } from './use-wallet-adjustment';
import WalletAdjustmentCard from './WalletAdjustmentCard';
import { WalletAdjustmentDialog } from './WalletAdjustmentDialog';

interface WalletCardProps {
  wallet: Wallet;
  isCollapsed: boolean;
}

const WalletCard: React.FC<WalletCardProps> = ({ wallet, isCollapsed }) => {
  const [isEditing, setIsEditing] = useState(false);
  const { formatCurrency } = useLocalFormat();
  const { adjustments, hasNextPage, fetchNextPage, error } =
    useWalletAdjustmentList({ walletId: wallet.id, pageSize: 10 });
  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border text-sm">
      <div className="border-border border-b p-4">
        <div className="flex items-center justify-between">
          <h2 className="m-0 font-semibold text-sm">{wallet.name}</h2>
          {!isCollapsed && (
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
          )}
        </div>
        <div className="mt-2 font-semibold text-lg">
          {formatCurrency(wallet.balance, wallet.currencyCode)}
        </div>
        {isCollapsed && (
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
              className="mt-3"
              onClick={(e) => {
                setIsEditing(true);
                e.preventDefault();
              }}
            >
              Adjust Balance
            </Button>
          </WalletAdjustmentDialog>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>
            <Trans>Error loading wallet adjustments: {error.message}</Trans>
          </AlertDescription>
        </Alert>
      )}

      <div
        className={twMerge(
          'min-h-30 overflow-y-auto p-4', // Base styles
          !isCollapsed ? 'max-h-50' : '',
        )}
      >
        <p className="mb-3 font-medium text-muted-foreground text-xs uppercase">
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
            <span className="mb-2 text-2xl">∅</span>
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
            className="mt-4 flex w-full items-center justify-center rounded-md border border-gray-200 bg-transparent py-2 font-medium text-gray-600 text-sm transition-all hover:bg-gray-50 active:scale-[0.98] dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50"
          >
            <Trans>Load more</Trans>
          </Button>
        )}
      </div>
    </div>
  );
};

export default WalletCard;
