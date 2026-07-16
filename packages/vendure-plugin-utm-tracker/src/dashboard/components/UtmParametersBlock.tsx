import {
  api,
  DateTime,
  Money,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useQuery } from '@tanstack/react-query';

const getUtmParametersDocument = graphql(`
  query GetUtmParameters($orderId: ID!) {
    order(id: $orderId) {
      id
      currencyCode
      utmParameters {
        id
        connectedAt
        campaignDisplayName
        attributedPercentage
        attributedValue
      }
    }
  }
`);

/**
 * Displays UTM parameters connected to an order, with their attributed value,
 * on the order detail page.
 */
export function UtmParametersBlock({ orderId }: { orderId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['order-utm-parameters', orderId],
    queryFn: () => api.query(getUtmParametersDocument, { orderId: orderId! }),
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-8 bg-muted rounded-md" />
        <div className="h-8 bg-muted rounded-md" />
      </div>
    );
  }

  const currencyCode = data?.order?.currencyCode;
  const utmParameters = data?.order?.utmParameters ?? [];

  if (utmParameters.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No UTM parameters found for this order.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Connected</TableHead>
          <TableHead>Campaign name</TableHead>
          <TableHead>Attributed Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {utmParameters.map((param) => (
          <TableRow key={param.id}>
            <TableCell>
              <DateTime value={param.connectedAt} />
            </TableCell>
            <TableCell>{param.campaignDisplayName}</TableCell>
            <TableCell>
              {param.attributedValue ? (
                <>
                  <Money value={param.attributedValue} currency={currencyCode} />
                  {' ('}
                  {Math.round((param.attributedPercentage ?? 0) * 100)}
                  {'%)'}
                </>
              ) : (
                '-'
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
