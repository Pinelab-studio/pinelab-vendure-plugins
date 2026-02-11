import { Wallet } from '../../api/generated/graphql';
import React, { useState } from 'react';
import WalletAdjustmentCard from './WalletAdjustmentCard';
import { WalletAdjustmentDialog } from './WalletAdjustmentDialog';

interface WalletCardProps {
  wallet: Wallet;
}

const WalletCard: React.FC<WalletCardProps> = ({ wallet }) => {
  const [isEditing, setIsEditing] = useState(false);
  return (
    <div
      className="
      w-[350px] flex flex-col overflow-hidden rounded-2xl border 
      border-gray-200 dark:border-gray-700 
      bg-white dark:bg-gray-800 
      shadow-md dark:shadow-2xl dark:shadow-black/50
    "
    >
      <div className="p-6 bg-slate-50 border-b border-gray-200 dark:bg-slate-900/50 dark:border-gray-800">
        <div className="flex justify-between items-center">
          <h2 className="m-0 text-[1.1rem] font-semibold text-gray-900 dark:text-gray-50">
            {wallet.name}
          </h2>

          <WalletAdjustmentDialog
            open={isEditing}
            onOpenChange={setIsEditing}
            walletId={wallet.id}
            customerName={'Abebe'}
          >
            <button
              onClick={(e) => {
                setIsEditing(true);
                e.preventDefault();
              }}
              className="px-3 py-1 text-xs font-semibold rounded-md border 
                  transition-colors duration-200
                  /* Light Mode Styles */
                  bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-gray-900
                  /* Dark Mode Styles */
                  dark:bg-slate-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              Adjust Balance
            </button>
          </WalletAdjustmentDialog>
        </div>

        <div className="mt-2 text-[2.2rem] font-extrabold text-emerald-600 dark:text-emerald-500 tracking-tight">
          {wallet.balance.toLocaleString()}
          <span className="ml-1 text-base font-medium text-gray-500 dark:text-gray-400">
            {wallet.currencyCode}
          </span>
        </div>
      </div>

      <div className="max-h-[200px] overflow-y-auto px-5 py-3 min-h-[120px]">
        <p className="text-xs font-bold text-gray-400 uppercase mb-3">
          Activity Log
        </p>

        {wallet.adjustments.length > 0 ? (
          wallet.adjustments.map((adj) => (
            <WalletAdjustmentCard key={adj.id} adjustment={adj} />
          ))
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-5 text-gray-400">
            <div className="text-4xl mb-2">∅</div>
            <p className="m-0 text-[0.85rem] italic text-center text-gray-500 dark:text-gray-400">
              No transactions found for this wallet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletCard;
