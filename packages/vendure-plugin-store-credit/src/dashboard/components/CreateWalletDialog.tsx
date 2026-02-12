import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMatches } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  api,
  Button,
  graphql,
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

export const CREATE_WALLET = graphql(`
  mutation CreateWallet($input: CreateWalletInput!) {
    createWallet(input: $input) {
      id
      name
      createdAt
      updatedAt
      currencyCode
      balance
      name
      adjustments {
        id
        createdAt
        amount
        description
        mutatedBy {
          id
          identifier
        }
      }
    }
  }
`);

interface CreateWalletFormInputs {
  name: string;
}

export const CreateWalletDialog: React.FC<
  React.ComponentProps<typeof AlertDialogPrimitive.Root>
> = ({ open: initialOpen, children, ...props }) => {
  const matches = useMatches();
  const customerId: string = matches.find((m) => m.params.id)?.params.id;
  const [open, setOpen] = React.useState(initialOpen);
  const queryClient = useQueryClient();

  const form = useForm<CreateWalletFormInputs>({
    defaultValues: { name: '' },
  });
  const {
    register,
    reset,
    formState: { errors },
  } = form;

  React.useEffect(() => {
    if (initialOpen === false) reset();
  }, [initialOpen, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (input: { customerId: string; name: string }) =>
      api.mutate(CREATE_WALLET, { input }),
    onSuccess: async () => {
      toast.success('Wallet created successfully');
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
            mutate({ customerId, ...data })
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Create Wallet</AlertDialogTitle>
            <AlertDialogDescription>
              Initialize a new wallet.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-4 py-4">
            <FormFieldWrapper
              label="Wallet Name"
              name="name"
              render={() => (
                <Input
                  placeholder="Personal Wallet"
                  {...register('name', { required: 'Name is required' })}
                />
              )}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <Button type="submit" disabled={isPending}>
              Create Wallet
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};
