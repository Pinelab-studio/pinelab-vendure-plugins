import {
  api,
  Badge,
  DateTime,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  usePermissions,
} from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useQuery } from '@tanstack/react-query';
import { CheckIcon, DownloadIcon, XIcon } from 'lucide-react';

const getOrderInvoicesDocument = graphql(`
  query GetOrderInvoices($id: ID!) {
    order(id: $id) {
      id
      invoices {
        id
        createdAt
        invoiceNumber
        isCreditInvoice
        downloadUrl
      }
    }
  }
`);

export function OrderInvoicesBlock({ orderId }: { orderId?: string }) {
  const { hasPermissions } = usePermissions();

  const { data, isLoading } = useQuery({
    queryKey: ['order-invoices', orderId],
    queryFn: () => api.query(getOrderInvoicesDocument, { id: orderId! }),
    enabled: !!orderId,
  });

  if (!hasPermissions(['AllowInvoicesPermission'])) {
    return null;
  }

  const invoices = (data?.order as any)?.invoices ?? [];

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-8 bg-muted rounded-md" />
        <div className="h-8 bg-muted rounded-md" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return <p className="text-sm text-muted-foreground">No invoices yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice Nr.</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Credit Invoice</TableHead>
          <TableHead>Download</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice: any) => (
          <TableRow key={invoice.id}>
            <TableCell>{invoice.invoiceNumber}</TableCell>
            <TableCell>
              <DateTime value={invoice.createdAt} />
            </TableCell>
            <TableCell>
              {invoice.isCreditInvoice ? (
                <Badge variant="secondary">
                  <CheckIcon className="h-3 w-3 mr-1" />
                  Yes
                </Badge>
              ) : (
                <XIcon className="h-4 w-4 text-muted-foreground" />
              )}
            </TableCell>
            <TableCell>
              <a
                href={invoice.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <DownloadIcon className="h-4 w-4" />
              </a>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
