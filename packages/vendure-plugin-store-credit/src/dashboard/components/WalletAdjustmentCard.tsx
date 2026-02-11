import React from 'react';
import { WalletAdjustment } from '../../api/generated/graphql';

interface Props {
  adjustment: WalletAdjustment;
}

const WalletAdjustmentCard: React.FC<Props> = ({ adjustment }) => {
  const isPositive = adjustment.amount >= 0;

  return (
    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800 text-[0.9rem]">
      <div>
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {adjustment.description}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
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
        {adjustment.amount.toLocaleString()}
      </div>
    </div>
  );
};

export default WalletAdjustmentCard;
