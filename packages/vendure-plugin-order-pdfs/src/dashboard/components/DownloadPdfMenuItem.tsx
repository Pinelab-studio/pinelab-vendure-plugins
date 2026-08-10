import { DropdownMenuItem } from '@vendure/dashboard';
import { useState } from 'react';
import { toast } from 'sonner';
import { PrinterIcon } from 'lucide-react';
import { TemplateSelectionDialog } from './TemplateSelectionDialog';
import { downloadOrderPdfs } from '../utils';

/**
 * Action bar dropdown item for downloading a PDF for a single order,
 * on the order detail page.
 */
export function DownloadPdfMenuItem({
  context,
}: {
  context: { entity?: any };
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const orderCode = context.entity?.code;

  if (!orderCode) {
    return null;
  }

  async function handleSelect(template: { id: string; name: string }) {
    setDialogOpen(false);
    toast.info('Starting download...');
    try {
      await downloadOrderPdfs(template.id, [orderCode], template.name);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to download PDF');
    }
  }

  return (
    <>
      <DropdownMenuItem
        closeOnClick={false}
        onClick={() => setDialogOpen(true)}
      >
        <PrinterIcon className="mr-2 h-4 w-4" />
        Download PDF
      </DropdownMenuItem>
      <TemplateSelectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orderCount={1}
        onSelect={handleSelect}
      />
    </>
  );
}
