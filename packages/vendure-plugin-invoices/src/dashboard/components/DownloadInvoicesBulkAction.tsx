import {
  BulkActionComponent,
  DataTableBulkActionItem,
  usePaginatedList,
} from '@vendure/dashboard';
import { toast } from 'sonner';
import { DownloadIcon } from 'lucide-react';
import { getAuthHeaders, getServerBaseUrl, downloadBlob } from '../utils';

export const DownloadInvoicesBulkAction: BulkActionComponent<any> = ({
  selection,
  table,
}) => {
  const { refetchPaginatedList } = usePaginatedList();

  // Only show in the bulk bar (multiple selected), not in per-row actions dropdown
  if (selection.length <= 1) {
    return null;
  }

  async function handleDownload() {
    try {
      const nrs = selection
        .map((item: any) => item.invoiceNumber as string)
        .join(',');
      const serverPath = getServerBaseUrl();
      const res = await fetch(`${serverPath}/invoices/download?nrs=${nrs}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(JSON.stringify(json?.message));
        return;
      }
      const blob = await res.blob();
      downloadBlob(blob, 'invoices.zip');
      table.resetRowSelection();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to download invoices');
    }
  }

  return (
    <DataTableBulkActionItem
      requiresPermission={['AllowInvoicesPermission']}
      onClick={handleDownload}
      label="Download invoices"
      icon={DownloadIcon}
    />
  );
};
