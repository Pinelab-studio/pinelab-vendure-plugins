import { api, Button } from '@vendure/dashboard';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { productVariantQlsUrlDocument } from '../qls-dashboard.graphql';

interface VisitQlsProductButtonProps {
  context: { entity?: any };
}

/**
 * Action bar button on the product variant detail page that opens the linked
 * QLS product in a new tab.
 */
export function VisitQlsProductButton({ context }: VisitQlsProductButtonProps) {
  const variantId = context.entity?.id;
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    if (!variantId) {
      toast.error('No variant selected.');
      return;
    }
    setIsPending(true);
    try {
      const result = await api.query(productVariantQlsUrlDocument, {
        id: variantId,
      });
      const url = result.productVariant?.qlsProductUrl;
      if (url) {
        window.open(url, '_blank');
      } else {
        toast.error('No QLS product found for this variant.');
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to load QLS product URL');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button variant="outline" disabled={isPending} onClick={handleClick}>
      <ExternalLink className="mr-2 h-4 w-4" />
      QLS
    </Button>
  );
}
