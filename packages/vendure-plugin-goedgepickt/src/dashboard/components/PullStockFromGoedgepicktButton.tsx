import { Button, api, useQueryClient } from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDownToLine } from 'lucide-react';

const pullGoedgepicktStockDocument = graphql(`
  mutation PullGoedgepicktStock($productId: ID!) {
    pullGoedgepicktStock(productId: $productId) {
      success
      updatedVariants
      errors {
        sku
        message
      }
    }
  }
`);

/**
 * Standalone action bar button for pulling stock from Goedgepickt
 * for all variants of a product, on the product detail page.
 */
export function PullStockFromGoedgepicktButton({
  context,
}: {
  context: { entity?: any };
}) {
  const productId = context.entity?.id;
  const queryClient = useQueryClient();

  const { mutate: pullStock, isPending } = useMutation({
    mutationFn: () =>
      api.mutate(pullGoedgepicktStockDocument, { productId: productId! }),
    onSuccess: (data) => {
      const result = data.pullGoedgepicktStock;
      // Invalidate all cached queries so the product detail page refreshes
      // with the updated stock levels
      queryClient.invalidateQueries();
      if (result.success && result.errors.length === 0) {
        toast.success(`Updated stock for ${result.updatedVariants} variants`);
      } else if (result.updatedVariants > 0) {
        const errorMessages = result.errors
          .map((e) => `${e.sku}: ${e.message}`)
          .join(', ');
        toast.error(
          `Updated ${result.updatedVariants} variants, but some failed: ${errorMessages}`
        );
      } else {
        const errorMessages = result.errors
          .map((e) => `${e.sku}: ${e.message}`)
          .join(', ');
        toast.error(`Failed to pull stock: ${errorMessages}`);
      }
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to pull stock from Goedgepickt');
    },
  });

  if (!productId) {
    return null;
  }

  return (
    <Button variant="outline" disabled={isPending} onClick={() => pullStock()}>
      <ArrowDownToLine
        className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
      />
      {isPending ? 'Pulling stock...' : 'Pull stock from Goedgepickt'}
    </Button>
  );
}
