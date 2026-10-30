import { useLocalFormat } from '@vendure/dashboard';
import React from 'react';
import { WalletAdjustment } from '../../api/generated/graphql';

interface Props {
  adjustment: WalletAdjustment;
  currencyCode: string;
}

const WalletAdjustmentCard: React.FC<Props> = ({
  adjustment,
  currencyCode,
}) => {
  const { formatCurrency } = useLocalFormat();
  const isPositive = adjustment.amount >= 0;

  return (
    <div className="flex justify-between border-border border-b py-2 last:border-0">
      <div>
        <div className="font-medium">{adjustment.description}</div>
        <div className="text-muted-foreground text-xs">
          {new Date(adjustment.createdAt).toLocaleDateString()}
          {adjustment.mutatedBy && ` • By: ${adjustment.mutatedBy.identifier}`}
        </div>
      </div>
      <div
        className={`font-bold ${
          isPositive
            ? 'text-green-700 dark:text-green-400'
            : 'text-red-700 dark:text-red-400'
        }`}
      >
        {isPositive ? '+' : ''}
        {formatCurrency(adjustment.amount, currencyCode)}
      </div>
    </div>
  );
};

export default WalletAdjustmentCard;
