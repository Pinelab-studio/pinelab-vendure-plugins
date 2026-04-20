import {
  api,
  Badge,
  Button,
  DashboardRouteDefinition,
  DetailPageButton,
  ListPage,
} from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DownloadIcon, RefreshCwIcon, ExternalLinkIcon } from 'lucide-react';
import { DownloadInvoicesBulkAction } from './DownloadInvoicesBulkAction';

const invoiceListQuery = graphql(`
  query InvoiceList($options: InvoiceListOptions) {
    invoices(options: $options) {
      items {
        id
        createdAt
        invoiceNumber
        downloadUrl
        isCreditInvoice
        orderCode
        orderId
        accountingReference {
          reference
          link
          errorMessage
        }
      }
      totalItems
    }
  }
`);

const exportToAccountingDocument = graphql(`
  mutation ExportInvoiceToAccountingPlatform($invoiceNumber: Int!) {
    exportInvoiceToAccountingPlatform(invoiceNumber: $invoiceNumber)
  }
`);

/**
 * Button to export a single invoice to the accounting platform.
 */
function ExportButton({ invoiceNumber }: { invoiceNumber: number }) {
  const { mutate, isPending } = useMutation({
    mutationFn: () => api.mutate(exportToAccountingDocument, { invoiceNumber }),
    onSuccess: () => toast.success('Export started'),
    onError: (err: Error) =>
      toast.error('Export failed', { description: err.message }),
  });
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => mutate()}
      disabled={isPending}
      title="Export to accounting"
    >
      <RefreshCwIcon className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
    </Button>
  );
}

export const invoiceListRoute: DashboardRouteDefinition = {
  navMenuItem: {
    sectionId: 'sales',
    id: 'invoice-list',
    url: '/invoice-list',
    title: 'Invoices',
  },
  path: '/invoice-list',
  loader: () => ({
    breadcrumb: 'Invoices',
  }),
  component: (route) => (
    <ListPage
      pageId="invoice-list"
      title="Invoices"
      listQuery={invoiceListQuery}
      route={route}
      onSearchTermChange={(searchTerm) => ({
        invoiceNumber: { contains: searchTerm },
        orderCode: { contains: searchTerm },
      })}
      transformVariables={(variables: any) => {
        // When a search term is active, the filter will contain multiple
        // fields. We need filterOperator=OR so both fields are matched.
        const filter = variables.options?.filter;
        const hasMultipleFilters = filter && Object.keys(filter).length > 1;
        return {
          ...variables,
          options: {
            ...variables.options,
            filterOperator: hasMultipleFilters ? 'OR' : 'AND',
          },
        };
      }}
      customizeColumns={{
        invoiceNumber: {
          header: 'Invoice Number',
          meta: { dependencies: ['orderId', 'isCreditInvoice'] },
          cell: ({ row }: any) => {
            const invoice = row.original;
            return (
              <span className="flex items-center gap-2">
                <DetailPageButton
                  href={`/orders/${invoice.orderId}`}
                  label={String(invoice.invoiceNumber)}
                />
                {invoice.isCreditInvoice && (
                  <Badge variant="secondary">CREDIT</Badge>
                )}
              </span>
            );
          },
        },
        orderCode: {
          header: 'Order',
          meta: { dependencies: ['orderId'] },
          cell: ({ row }: any) => (
            <DetailPageButton
              href={`/orders/${row.original.orderId}`}
              label={row.original.orderCode}
            />
          ),
        },
        accountingReference: {
          header: 'Accounting',
          cell: ({ row }: any) => {
            const ref = row.original.accountingReference;
            if (!ref) return null;
            if (ref.errorMessage) {
              return (
                <span className="text-destructive text-sm">
                  Failed: {ref.errorMessage}
                </span>
              );
            }
            if (ref.reference && ref.link) {
              return (
                <a
                  href={ref.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-success hover:underline"
                >
                  Exported
                  <ExternalLinkIcon className="h-3 w-3" />
                </a>
              );
            }
            if (ref.reference) {
              return <span className="text-sm">{ref.reference}</span>;
            }
            return null;
          },
        },
        downloadUrl: {
          header: 'Download',
          cell: ({ row }: any) => (
            <a
              href={row.original.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <DownloadIcon className="h-4 w-4" />
            </a>
          ),
        },
        // Hide fields that are only used as dependencies
        orderId: { meta: { disabled: true } },
        isCreditInvoice: { meta: { disabled: true } },
      }}
      additionalColumns={{
        export: {
          header: 'Export',
          cell: ({ row }: any) => (
            <ExportButton invoiceNumber={row.original.invoiceNumber} />
          ),
        },
      }}
      defaultVisibility={{
        invoiceNumber: true,
        createdAt: true,
        orderCode: true,
        accountingReference: true,
        downloadUrl: true,
        export: true,
      }}
      defaultColumnOrder={[
        'invoiceNumber',
        'createdAt',
        'orderCode',
        'accountingReference',
        'downloadUrl',
        'export',
      ]}
      bulkActions={[{ component: DownloadInvoicesBulkAction }]}
    />
  ),
};
