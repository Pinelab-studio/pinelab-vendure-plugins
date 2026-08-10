import {
  api,
  DashboardBaseWidget,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useQuery } from '@tanstack/react-query';

const productVariantsWithLowStockDocument = graphql(`
  query ProductVariantsWithLowStock {
    productVariantsWithLowStock {
      id
      name
      enabled
      stockOnHand
      productId
      stockLevels {
        stockOnHand
        stockAllocated
      }
    }
  }
`);

function getAvailableStock(
  stockLevels: { stockOnHand: number; stockAllocated: number }[]
): number {
  return stockLevels.reduce(
    (acc, val) => acc + val.stockOnHand - (val.stockAllocated ?? 0),
    0
  );
}

/**
 * Dashboard home page widget listing product variants below their stock
 * threshold. Sort order is determined server-side (ascending available stock).
 */
export function LowStockWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['low-stock-variants'],
    queryFn: () => api.query(productVariantsWithLowStockDocument, {}),
  });

  const variants = data?.productVariantsWithLowStock ?? [];

  return (
    <DashboardBaseWidget
      id="low-stock"
      title="Low stock"
      description="Product variants below their stock threshold"
    >
      {isLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-muted rounded-md" />
          <div className="h-8 bg-muted rounded-md" />
        </div>
      ) : variants.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No variants below their stock threshold.
        </p>
      ) : (
        <div className="max-h-[300px] overflow-y-auto">
          <Table>
            <TableBody>
              {variants.map((variant) => {
                const available = getAvailableStock(variant.stockLevels);
                return (
                  <TableRow
                    key={variant.id}
                    className={available <= 0 ? 'bg-destructive/10' : undefined}
                  >
                    <TableCell>
                      <a
                        href={`/product-variants/${variant.id}`}
                        className="hover:underline"
                      >
                        {variant.name}
                      </a>
                    </TableCell>
                    <TableCell className="text-right">{available}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </DashboardBaseWidget>
  );
}
