import { DataTableBulkActionItem } from '@vendure/dashboard';
import { useState } from 'react';
import { toast } from 'sonner';
import { PrinterIcon } from 'lucide-react';
import { TemplateSelectionDialog } from './TemplateSelectionDialog';
import { downloadOrderPdfs } from '../utils';

/**
 * Bulk action for downloading PDFs for multiple selected orders,
 * registered on the built-in order-list page.
 */
export function DownloadPdfBulkAction({
  selection,
  table,
}: {
  selection: any[];
  table: { resetRowSelection: () => void };
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleSelect(template: { id: string; name: string }) {
    setDialogOpen(false);
    const orderCodes = selection.map((order) => order.code);
    toast.info('Starting download...');
    try {
      await downloadOrderPdfs(template.id, orderCodes, template.name);
      table.resetRowSelection();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to download PDF');
    }
  }

  return (
    <>
      <DataTableBulkActionItem
        requiresPermission={['AllowPDFDownload']}
        onClick={() => setDialogOpen(true)}
        label="Download PDF"
        icon={PrinterIcon}
      />
      <TemplateSelectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orderCount={selection.length}
        onSelect={handleSelect}
      />
    </>
  );
}
