import { defineDashboardExtension } from '@vendure/dashboard';
import { StripeSubscriptionHistoryEntry } from './components/StripeSubscriptionHistoryEntry';

defineDashboardExtension({
  historyEntries: [
    {
      type: 'STRIPE_SUBSCRIPTION_NOTIFICATION',
      component: ({ entry }) => (
        <StripeSubscriptionHistoryEntry entry={entry} />
      ),
    },
  ],
});
