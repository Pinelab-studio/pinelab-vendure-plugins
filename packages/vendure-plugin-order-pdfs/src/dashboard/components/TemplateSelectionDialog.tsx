import {
  api,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useQuery } from '@tanstack/react-query';

const pdfTemplateNamesDocument = graphql(`
  query PdfTemplateNamesForDownload {
    pdfTemplates {
      items {
        id
        name
        enabled
      }
    }
  }
`);

export function TemplateSelectionDialog({
  open,
  onOpenChange,
  orderCount,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderCount: number;
  onSelect: (template: { id: string; name: string }) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['pdf-template-names'],
    queryFn: () => api.query(pdfTemplateNamesDocument, {}),
    enabled: open,
  });

  const templates = (data?.pdfTemplates.items ?? []).filter((t) => t.enabled);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select a PDF template</DialogTitle>
          <DialogDescription>
            You are about to download PDF files for {orderCount} order
            {orderCount === 1 ? '' : 's'}. Please select a template to use.
          </DialogDescription>
        </DialogHeader>
        {!isLoading && templates.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No enabled PDF templates found.
          </p>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {templates.map((template) => (
            <Button
              key={template.id}
              type="button"
              className="w-full"
              onClick={() => onSelect(template)}
            >
              {template.name}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
