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
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <div>
        <div className="font-medium">{adjustment.description}</div>
        <div className="text-xs text-muted-foreground">
          {new Date(adjustment.createdAt).toLocaleDateString()} • By:{' '}
          {adjustment.mutatedBy.identifier}
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
