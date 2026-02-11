import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  api,
  graphql,
  Button,
  Input,
  FormFieldWrapper,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  handleNestedFormSubmit,
} from '@vendure/dashboard';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';

interface MyCustomFormProps
  extends React.ComponentProps<typeof AlertDialogPrimitive.Root> {
  walletId: string | number;
  customerName: string;
}

export const ADJUST_WALLET = graphql(`
  mutation UpdateWallet($input: AdjustBalanceForWalletInput!) {
    adjustBalanceForWallet(input: $input) {
      id
      name
      createdAt
      updatedAt
      currencyCode
      balance
      adjustments {
        id
        amount
        createdAt
        description
        mutatedBy {
          id
          identifier
        }
      }
    }
  }
`);

export const WalletAdjustmentDialog = ({
  walletId,
  open: initialOpen,
  children,
}: MyCustomFormProps) => {
  const [open, setOpen] = React.useState(initialOpen);
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: { amount: 0, description: '' },
  });

  const {
    register,
    reset,
    formState: { errors },
  } = form;

  const { mutate, isPending } = useMutation({
    mutationFn: (input: any) => api.mutate(ADJUST_WALLET, { input }),
    onSuccess: async () => {
      toast.success('Balance updated successfully');
      await queryClient.invalidateQueries({ queryKey: ['customer'] });
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild onClick={() => setOpen(true)}>
        {children}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <form
          onSubmit={handleNestedFormSubmit(form, (data) =>
            mutate({ ...data, walletId })
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Adjust Balance</AlertDialogTitle>
            <AlertDialogDescription>Modifying wallet</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-4 py-4">
            <FormFieldWrapper
              label="Amount"
              name="amount"
              render={() => (
                <Input
                  type="number"
                  step="0.01"
                  {...register('amount', {
                    required: 'Required',
                    valueAsNumber: true,
                  })}
                />
              )}
            />
            <FormFieldWrapper
              label="Reason"
              name="description"
              render={() => (
                <Input
                  placeholder="Adjustment reason..."
                  {...register('description', { required: 'Required' })}
                />
              )}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="submit" disabled={isPending}>
              Confirm
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};
