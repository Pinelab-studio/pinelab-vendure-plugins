import { PanelLeftOpen } from 'lucide-react';
import { Button } from '@/vdb/components/ui/button.js';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/vdb/components/ui/sheet.js';
import { Wallet } from '../../api/generated/graphql';
import WalletCard from './WalletCard';

export interface CustomerGroupMembersSheetProps {
  wallet: Wallet;
  children?: React.ReactNode;
}

export function GiftCardWalletDetailSheet({
  wallet,
  children,
}: CustomerGroupMembersSheetProps) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          />
        }
      >
        {children}
        <PanelLeftOpen className="h-4 w-4" />
      </SheetTrigger>
      <SheetContent className="min-w-[90vw] lg:min-w-200">
        <div className="px-4">
          <div style={{ width: '100%' }}>
            <WalletCard key={wallet.id} wallet={wallet} isCollapsed={true} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
