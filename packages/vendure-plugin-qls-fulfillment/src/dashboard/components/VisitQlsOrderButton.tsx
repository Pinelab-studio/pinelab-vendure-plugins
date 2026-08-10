import { api, Button } from '@vendure/dashboard';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { orderQlsUrlDocument } from '../qls-dashboard.graphql';

interface VisitQlsOrderButtonProps {
  context: { entity?: any };
}

/**
 * Action bar button on the order detail page that opens the linked QLS order
 * in a new tab. Only renders when the order has been placed.
 */
export function VisitQlsOrderButton({ context }: VisitQlsOrderButtonProps) {
  const orderId = context.entity?.id;
  const orderPlacedAt = context.entity?.orderPlacedAt;
  const [isPending, setIsPending] = useState(false);

  if (!orderPlacedAt) {
    return null;
  }

  const handleClick = async () => {
    if (!orderId) {
      toast.error('No order selected.');
      return;
    }
    setIsPending(true);
    try {
      const result = await api.query(orderQlsUrlDocument, { id: orderId });
      const url = result.order?.qlsOrderUrl;
      if (url) {
        window.open(url, '_blank');
      } else {
        toast.error('No QLS order found for this order.');
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to load QLS order URL');
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
