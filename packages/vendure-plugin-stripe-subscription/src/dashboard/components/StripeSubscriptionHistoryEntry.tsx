import { HistoryEntry } from '@vendure/dashboard';
import { AlertTriangleIcon, ExternalLinkIcon, ReceiptIcon } from 'lucide-react';

interface StripeSubscriptionHistoryEntryData {
  message: string;
  valid: boolean;
  error?: unknown;
  subscriptionId?: string;
  subscription?: unknown;
}

/**
 * Renders the STRIPE_SUBSCRIPTION_NOTIFICATION history entry type on the
 * order detail page's timeline.
 */
export function StripeSubscriptionHistoryEntry({ entry }: { entry: any }) {
  const data = entry.data as StripeSubscriptionHistoryEntryData;
  const isFeatured = !data.valid;

  return (
    <HistoryEntry
      entry={entry}
      title="Stripe Subscriptions"
      timelineIcon={isFeatured ? <AlertTriangleIcon /> : <ReceiptIcon />}
      timelineIconClassName={
        isFeatured
          ? 'bg-destructive text-destructive-foreground'
          : 'bg-success text-success-foreground'
      }
    >
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <span>{data.message}</span>
          {data.subscriptionId && (
            <a
              href={`https://dashboard.stripe.com/subscriptions/${data.subscriptionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          )}
        </div>
        {data.error ? (
          <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">
            {JSON.stringify(data.error, null, 2)}
          </pre>
        ) : null}
        {data.subscription ? (
          <details>
            <summary className="cursor-pointer text-muted-foreground">
              Subscription
            </summary>
            <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">
              {JSON.stringify(data.subscription, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    </HistoryEntry>
  );
}
