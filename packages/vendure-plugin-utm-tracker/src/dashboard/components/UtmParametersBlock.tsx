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
        utmSource
        utmMedium
        utmCampaign
        utmTerm
        utmContent
        clid
        attributedPercentage
        attributedValue
      }
    }
  }
`);

/**
 * Fetches and caches the UTM parameters connected to an order.
 */
function useUtmParameters(orderId?: string) {
  return useQuery({
    queryKey: ['order-utm-parameters', orderId],
    queryFn: () => api.query(getUtmParametersDocument, { orderId: orderId! }),
    enabled: !!orderId,
  });
}

/**
 * Displays UTM attribution connected to an order.
 */
export function UtmAttributionBlock({ orderId }: { orderId?: string }) {
  const { data, isLoading } = useUtmParameters(orderId);

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
                  <Money
                    value={param.attributedValue}
                    currency={currencyCode}
                  />
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

/**
 * Displays every raw tracking value connected to an order.
 */
export function UtmParametersBlock({ orderId }: { orderId?: string }) {
  const { data, isLoading } = useUtmParameters(orderId);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-8 bg-muted rounded-md" />
        <div className="h-8 bg-muted rounded-md" />
      </div>
    );
  }

  const utmParameters = data?.order?.utmParameters ?? [];

  if (utmParameters.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No UTM parameters found for this order.
      </p>
    );
  }

  const displayValue = (value?: string | null) =>
    value == null || value === '' ? '-' : value;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Connected</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Medium</TableHead>
          <TableHead>Campaign</TableHead>
          <TableHead>Term</TableHead>
          <TableHead>Content</TableHead>
          <TableHead>Client ID</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {utmParameters.map((param) => (
          <TableRow key={param.id}>
            <TableCell>
              {param.connectedAt ? <DateTime value={param.connectedAt} /> : '-'}
            </TableCell>
            <TableCell>{displayValue(param.utmSource)}</TableCell>
            <TableCell>{displayValue(param.utmMedium)}</TableCell>
            <TableCell>{displayValue(param.utmCampaign)}</TableCell>
            <TableCell>{displayValue(param.utmTerm)}</TableCell>
            <TableCell>{displayValue(param.utmContent)}</TableCell>
            <TableCell>{displayValue(param.clid)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
