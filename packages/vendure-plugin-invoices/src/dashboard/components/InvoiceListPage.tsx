import {
  api,
  Badge,
  BulkActionComponent,
  DashboardRouteDefinition,
  DataTableBulkActionItem,
  DetailPageButton,
  ListPage,
} from '@vendure/dashboard';

import { graphql } from '@/gql';
import { toast } from 'sonner';
import { DownloadIcon, ExternalLinkIcon } from 'lucide-react';
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
 * Row-level bulk action to export a single invoice to accounting.
 * Shows "Re-export" if the invoice was already exported successfully.
 */
function ExportToAccountingAction({
  selection,
}: Parameters<BulkActionComponent<any>>[0]) {
  const invoice = selection[0];
  const ref = invoice?.accountingReference;
  const alreadyExported = ref?.reference && !ref?.errorMessage;

  async function handleExport() {
    try {
      await api.mutate(exportToAccountingDocument, {
        invoiceNumber: invoice.invoiceNumber,
      });
      toast.success('Export started');
    } catch (err: any) {
      toast.error('Export failed', { description: err.message });
    }
  }

  return (
    <DataTableBulkActionItem
      onClick={handleExport}
      label={
        alreadyExported ? 'Re-export to accounting' : 'Export to accounting'
      }
      icon={ExternalLinkIcon}
    />
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
          meta: { dependencies: ['orderId', 'isCreditInvoice', 'downloadUrl'] },
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
        // Hide fields that are only used as dependencies or row actions
        downloadUrl: { meta: { disabled: true } },
        orderId: { meta: { disabled: true } },
        isCreditInvoice: { meta: { disabled: true } },
      }}
      rowActions={[
        {
          label: (
            <span className="flex items-center gap-2">
              <DownloadIcon className="h-4 w-4" />
              Download
            </span>
          ),
          onClick: (row: any) => {
            window.open(row.original.downloadUrl, '_blank');
          },
        },
      ]}
      defaultVisibility={{
        invoiceNumber: true,
        createdAt: true,
        orderCode: true,
        accountingReference: true,
      }}
      defaultColumnOrder={[
        'invoiceNumber',
        'createdAt',
        'orderCode',
        'accountingReference',
      ]}
      bulkActions={[
        { component: ExportToAccountingAction },
        { component: DownloadInvoicesBulkAction },
      ]}
    />
  ),
};
