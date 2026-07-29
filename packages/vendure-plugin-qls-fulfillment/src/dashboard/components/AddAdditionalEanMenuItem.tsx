import {
  api,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenuItem,
  Input,
  Label,
} from '@vendure/dashboard';
import { useMutation } from '@tanstack/react-query';
import { QrCode } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { addAdditionalEanToQlsDocument } from '../qls-dashboard.graphql';

interface AddAdditionalEanMenuItemProps {
  context: { entity?: any };
}

/**
 * Dropdown action bar item on the product variant detail page that prompts
 * for an additional EAN and sends it to QLS.
 */
export function AddAdditionalEanMenuItem({
  context,
}: AddAdditionalEanMenuItemProps) {
  const variantId = context.entity?.id;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ean, setEan] = useState('');

  const { mutate: addEan, isPending } = useMutation({
    mutationFn: () =>
      api.mutate(addAdditionalEanToQlsDocument, {
        variantId: variantId!,
        additionalEANS: [ean],
      }),
    onSuccess: () => {
      toast.success(`Added EAN ${ean} to QLS`);
      setEan('');
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to add EAN to QLS');
    },
  });

  const handleConfirm = () => {
    if (!ean.trim()) {
      return;
    }
    addEan();
  };

  return (
    <>
      <DropdownMenuItem
        disabled={!variantId}
        onClick={() => setDialogOpen(true)}
      >
        <QrCode className="mr-2 h-4 w-4" />
        Add additional EAN to QLS
      </DropdownMenuItem>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add additional EAN to QLS</DialogTitle>
            <DialogDescription>
              Enter the additional EAN to add to this variant in QLS.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ean">EAN</Label>
              <Input
                id="ean"
                value={ean}
                onChange={(e) => setEan(e.target.value)}
                placeholder="EAN"
                disabled={isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!ean.trim() || isPending}
              onClick={handleConfirm}
            >
              Add EAN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
