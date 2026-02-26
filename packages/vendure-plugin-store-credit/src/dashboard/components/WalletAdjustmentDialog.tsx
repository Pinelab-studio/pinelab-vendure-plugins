import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  api,
  graphql,
  Button,
  Input,
  MoneyInput,
  FormFieldWrapper,
  Switch,
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

type AdjustDirection = 'add' | 'subtract';

interface MyCustomFormProps
  extends React.ComponentProps<typeof AlertDialogPrimitive.Root> {
  walletId: string | number;
  currencyCode: string;
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
    }
  }
`);

export const WalletAdjustmentDialog = ({
  walletId,
  currencyCode,
  open: initialOpen,
  children,
}: MyCustomFormProps) => {
  const [open, setOpen] = React.useState(initialOpen);
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: {
      direction: 'add' as AdjustDirection,
      amount: 0,
      description: '',
    },
  });

  const { control, register, reset, watch, setValue } = form;

  const { mutate, isPending } = useMutation({
    mutationFn: (input: any) => api.mutate(ADJUST_WALLET, { input }),
    onSuccess: async () => {
      toast.success('Balance updated successfully');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wallet', walletId] }),
        queryClient.invalidateQueries({ queryKey: ['customer'] }),
      ]);
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
          onSubmit={handleNestedFormSubmit(form, (data) => {
            const sign = data.direction === 'subtract' ? -1 : 1;
            mutate({
              walletId,
              description: data.description,
              amount: data.amount * sign,
            });
          })}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Adjust Balance</AlertDialogTitle>
            <AlertDialogDescription>
              {watch('direction') === 'subtract'
                ? 'Subtract from the wallet'
                : 'Add to the wallet'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-4 py-4">
            <FormFieldWrapper
              control={control}
              label="Amount"
              name="amount"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={watch('direction') === 'subtract'}
                      onCheckedChange={(checked) =>
                        setValue('direction', checked ? 'subtract' : 'add')
                      }
                      className="data-[state=unchecked]:bg-green-600 data-[state=unchecked]:dark:bg-green-500 data-[state=checked]:bg-red-600 data-[state=checked]:dark:bg-red-500"
                    />
                    <span
                      className={`text-sm font-semibold ${
                        watch('direction') === 'subtract'
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-green-700 dark:text-green-400'
                      }`}
                    >
                      {watch('direction') === 'subtract' ? '−' : '+'}
                    </span>
                  </div>
                  <MoneyInput
                    {...field}
                    value={Number(field.value) || 0}
                    onChange={(value) => field.onChange(value)}
                    currency={currencyCode}
                  />
                </div>
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
