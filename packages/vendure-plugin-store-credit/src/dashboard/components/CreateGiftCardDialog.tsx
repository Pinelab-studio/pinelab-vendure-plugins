import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  api,
  Button,
  FormFieldWrapper,
  graphql,
  handleNestedFormSubmit,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  useChannel,
  useLocalFormat,
} from '@vendure/dashboard';

const CREATE_GIFT_CARD = graphql(`
  mutation CreateGiftCard($input: CreateWalletInput!) {
    createWallet(input: $input) {
      id
    }
  }
`);

const SET_INITIAL_GIFT_CARD_BALANCE = graphql(`
  mutation SetInitialGiftCardBalance($input: AdjustBalanceForWalletInput!) {
    adjustBalanceForWallet(input: $input) {
      id
    }
  }
`);

interface CreateGiftCardFormInputs {
  code: string;
  amount: string;
}

/** Creates a customerless gift-card wallet and sets its initial balance. */
export const CreateGiftCardDialog: React.FC<
  React.ComponentProps<typeof AlertDialogPrimitive.Root>
> = ({ open: initialOpen, children }) => {
  const [open, setOpen] = React.useState(initialOpen);
  const { activeChannel } = useChannel();
  const { toMinorUnits } = useLocalFormat();
  const queryClient = useQueryClient();
  const form = useForm<CreateGiftCardFormInputs>({
    defaultValues: { code: '', amount: '' },
  });
  const { control, register, reset } = form;

  const { mutate, isPending } = useMutation({
    mutationFn: async ({ code, amount }: CreateGiftCardFormInputs) => {
      const trimmedCode = code.trim();
      const result = await api.mutate(CREATE_GIFT_CARD, {
        input: { code: trimmedCode, name: trimmedCode },
      });

      try {
        await api.mutate(SET_INITIAL_GIFT_CARD_BALANCE, {
          input: {
            walletId: result.createWallet.id,
            amount: toMinorUnits(Number(amount)),
            description: 'Initial balance',
          },
        });
      } finally {
        setOpen(false);
        reset();
        await queryClient.invalidateQueries();
      }
    },
    onSuccess: () => toast.success('Gift card created successfully'),
    onError: (err) => toast.error(err.message),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild onClick={() => setOpen(true)}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={handleNestedFormSubmit(form, (data) => mutate(data))}>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Gift Card</AlertDialogTitle>
            <AlertDialogDescription>
              Create a gift card with an initial balance. Gift card codes must
              be unique and hard to guess!
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-4 py-4">
            <FormFieldWrapper
              control={control}
              label="Gift Card Code"
              name="code"
              render={() => (
                <Input
                  placeholder="GIFT-CARD-CODE"
                  {...register('code', {
                    required: 'Code is required',
                    validate: (value) =>
                      value.trim().length > 0 || 'Code is required',
                  })}
                />
              )}
            />
            <FormFieldWrapper
              control={control}
              label="Initial Balance"
              name="amount"
              rules={{
                required: 'Initial balance is required',
                validate: (value) =>
                  Number(value) > 0 ||
                  'Initial balance must be greater than zero',
              }}
              render={({ field }) => (
                <InputGroup>
                  <InputGroupInput
                    {...field}
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>
                      {activeChannel?.defaultCurrencyCode}
                    </InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              )}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <Button type="submit" disabled={isPending}>
              Create Gift Card
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};
