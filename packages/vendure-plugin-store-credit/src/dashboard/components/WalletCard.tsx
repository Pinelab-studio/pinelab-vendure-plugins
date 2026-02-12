import { Button, useLocalFormat } from '@vendure/dashboard';
import { Wallet } from '../../api/generated/graphql';
import React, { useState } from 'react';
import WalletAdjustmentCard from './WalletAdjustmentCard';
import { WalletAdjustmentDialog } from './WalletAdjustmentDialog';

interface WalletCardProps {
  wallet: Wallet;
}

const WalletCard: React.FC<WalletCardProps> = ({ wallet }) => {
  const [isEditing, setIsEditing] = useState(false);
  const { formatCurrency } = useLocalFormat();
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

      <div className="max-h-[200px] overflow-y-auto p-4 min-h-[120px]">
        <p className="text-xs font-medium uppercase mb-3 text-muted-foreground">
          Activity Log
        </p>
        {wallet.adjustments.length > 0 ? (
          wallet.adjustments.map((adj) => (
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
      </div>
    </div>
  );
};

export default WalletCard;
