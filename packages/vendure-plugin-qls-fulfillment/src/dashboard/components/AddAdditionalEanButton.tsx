import {
  api,
  Button,
  ConfirmationDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@vendure/dashboard';
import { useMutation } from '@tanstack/react-query';
import { QrCode } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { addAdditionalEanToQlsDocument } from '../qls-dashboard.graphql';

interface AddAdditionalEanButtonProps {
  context: { entity?: any };
}

/**
 * Action bar button on the product variant detail page that prompts
 * for an additional EAN and sends it to QLS.
 *
 * NOTE: This is deliberately a regular action bar button and NOT a dropdown
 * (`type: 'dropdown'`) action bar item. Dropdown items are rendered inside a
 * Base UI menu popup, which unmounts its children when the menu closes, and
 * while the (modal) menu is open it intercepts keyboard events. Both make it
 * impossible to have a working dialog with a text input inside a dropdown
 * item. Vendure itself only uses button-only AlertDialogs inside dropdown
 * menus; dialogs with inputs are always opened from outside a menu.
 */
export function AddAdditionalEanButton({
  context,
}: AddAdditionalEanButtonProps) {
  const variantId = context.entity?.id;
  const variantName = context.entity?.name;
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
      <Button
        variant="outline"
        disabled={!variantId}
        onClick={() => setDialogOpen(true)}
      >
        <QrCode className="mr-2 h-4 w-4" />
        Add EAN
      </Button>
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
            <ConfirmationDialog
              title="Weet je het zeker?"
              description={`Wil je EAN "${ean}" toevoegen aan product "${variantName}"?`}
              onConfirm={handleConfirm}
            >
              <Button type="button" disabled={!ean.trim() || isPending}>
                Add EAN
              </Button>
            </ConfirmationDialog>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
